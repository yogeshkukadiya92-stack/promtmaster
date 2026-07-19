import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createSupabaseRepository } from "./supabase-repository.mjs";
import { executeToolCall, registeredTools, toolRequiresApproval, toolRiskLevel } from "./tool-gateway.mjs";
import { createAgentPlanner } from "./agent-planner.mjs";
import { createEmailProvider } from "./email-provider.mjs";

const repository = createSupabaseRepository();
if (!repository) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the agent worker.");

const workerName = process.env.AGENT_WORKER_NAME || `worker-${randomUUID().slice(0, 8)}`;
const planner = createAgentPlanner();
const emailProvider=createEmailProvider();
const pollMs = Math.max(500, Number(process.env.AGENT_WORKER_POLL_MS || 1500));
const leaseSeconds = Math.max(15, Number(process.env.AGENT_WORKER_LEASE_SECONDS || 60));
let lastRecoveryAt = 0;
let lastScheduleAt = 0;
let lastMemoryPurgeAt = 0;
let lastHeartbeatAt = 0;
let lastLifecycleAt=0;
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
console.log("agent_worker_started", { workerName, pollMs, leaseSeconds, tools: registeredTools });

while (!stopping) {
  let activeJob = null;
  try {
    if (Date.now() - lastHeartbeatAt > 15000) {
      await repository.heartbeatAgentWorker(workerName, stopping ? "draining" : "online", 0, 0, { pollMs, leaseSeconds, planner: planner.model ? "model" : "deterministic" });
      lastHeartbeatAt = Date.now();
    }
    if (Date.now() - lastMemoryPurgeAt > 60 * 60 * 1000) {
      const purged = await repository.purgeExpiredAgentMemories(100);
      if (purged) console.log("agent_memories_expired", { purged });
      lastMemoryPurgeAt = Date.now();
    }
    if (Date.now() - lastScheduleAt > 30000) {
      const scheduled = await repository.materializeDueAgentSchedules(20);
      if (scheduled) console.log("agent_schedules_materialized", { scheduled });
      lastScheduleAt = Date.now();
    }
    if (Date.now() - lastRecoveryAt > 30000) {
      const recovered = await repository.recoverStaleAgentJobs(leaseSeconds);
      if (recovered) console.log("agent_jobs_recovered", { recovered });
      lastRecoveryAt = Date.now();
    }
    if(Date.now()-lastLifecycleAt>30000){const materialized=await repository.materializeLifecycleDeliveries(100);let delivered=0;for(let index=0;index<5;index+=1){const delivery=await repository.claimLifecycleDelivery();if(!delivery)break;try{if(delivery.channel==="in_app"){await repository.completeLifecycleDelivery(delivery.id,"in-app");delivered+=1;continue;}if(!emailProvider)throw Object.assign(new Error("Lifecycle email provider is not configured."),{code:"EMAIL_PROVIDER_UNAVAILABLE"});const copy=delivery.key==="complete_first_test"?{subject:"Your IntentOS capability is ready to test",headline:"Turn your draft into a trusted capability",body:"Run the saved test suite to verify quality before sharing your capability.",actionLabel:"Open Playground"}:{subject:"Your tested capability is ready to publish",headline:"Share what you built",body:"Your capability has been tested. Complete its trust scan and submit it for review.",actionLabel:"Open Publishing"};const result=await emailProvider.sendLifecycle({to:delivery.email,...copy,actionUrl:process.env.APP_URL||"http://localhost:4173"});await repository.completeLifecycleDelivery(delivery.id,result.id);delivered+=1;}catch(error){await repository.failLifecycleDelivery(delivery.id,error?.code||"DELIVERY_FAILED");}}if(materialized||delivered)console.log("lifecycle_cycle_completed",{materialized,delivered});lastLifecycleAt=Date.now();}
    const job = await repository.claimAgentJob(workerName);
    if (!job) { await pause(pollMs); continue; }
    activeJob = job;
    const run = await repository.getWorkerRun(job.run_id);
    const completedTools = new Set(await repository.listCompletedToolNames(run.id));
    const storedPlan = await repository.getAgentPlan(run.id);
    const executionPlan = storedPlan || await planner.plan(run);
    if (!storedPlan) await repository.recordAgentPlan(run.id, executionPlan);
    const plan = executionPlan.calls.filter((call) => !completedTools.has(call.name));
    const results = await repository.listAgentToolResults(run.id);
    let pausedForApproval = false;
    for (const call of plan) {
      if (toolRequiresApproval(call.name)) {
        const approval = await repository.requestAgentActionApproval(job.id, workerName, call, toolRiskLevel(call.name));
        if (approval?.status !== "approved") {
          pausedForApproval = approval?.status === "pending";
          if (!pausedForApproval) throw Object.assign(new Error(`${call.name} approval was rejected.`), { code: "ACTION_REJECTED" });
          activeJob = null;
          break;
        }
      }
      const result = await executeToolCall(call, run.permissions, {
        scopedApproval: true,
        createWorkspaceNote: (content) => repository.createWorkspaceNote(run.id, content),
        rememberMemory: (content, retentionDays) => repository.rememberAgentMemory(run.id, content, retentionDays),
      });
      await repository.recordAgentToolCall(job.id, workerName, result);
      results.push(result);
      if (result.status !== "completed") throw Object.assign(new Error(`${result.toolName} ${result.status}.`), { code: result.errorCode });
    }
    if (pausedForApproval) continue;
    const verification = await planner.verify({ run, plan: executionPlan, results });
    await repository.recordAgentVerification(run.id, verification);
    if (!verification.passed) throw Object.assign(new Error(verification.summary), { code: "VERIFICATION_FAILED" });
    const completed = await repository.completeAgentJob(job.id, workerName);
    if (completed) await repository.heartbeatAgentWorker(workerName, "online", 1, 0, { pollMs, leaseSeconds, planner: planner.model ? "model" : "deterministic" });
    console.log("agent_job_finished", { jobId: job.id, runId: job.run_id, completed });
  } catch (error) {
    console.error("agent_worker_error", { message: error?.message });
    if (activeJob) {
      try { await repository.failAgentJob(activeJob.id, workerName, error?.message); await repository.heartbeatAgentWorker(workerName, "online", 0, 1, { pollMs, leaseSeconds, planner: planner.model ? "model" : "deterministic" }); }
      catch (failureError) { console.error("agent_job_failure_persist_error", { message: failureError?.message }); }
    }
    await pause(pollMs);
  }
}
await repository.heartbeatAgentWorker(workerName, "offline", 0, 0, { pollMs, leaseSeconds, planner: planner.model ? "model" : "deterministic" }).catch(() => {});
console.log("agent_worker_stopped", { workerName });
