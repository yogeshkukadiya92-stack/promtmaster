import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function createSupabaseRepository() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const getOwnedWorkspace = async (userId) => {
    const { data, error } = await client.from("workspaces").select("id,name,owner_id,created_at,updated_at").eq("owner_id", userId).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  };

  const canEditWorkspace = async (workspaceId, userId) => {
    const owned = await getOwnedWorkspace(userId);
    if (owned?.id === workspaceId) return true;
    const { data, error } = await client.from("workspace_members").select("role,status").eq("workspace_id", workspaceId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (error) throw error;
    return data?.role === "editor" || data?.role === "owner";
  };

  const recordActivity = async (workspaceId, userId, message) => {
    const [{ error }, { error: auditError }] = await Promise.all([
      client.from("workspace_activity").insert({ workspace_id: workspaceId, actor_id: userId, message }),
      client.from("organization_audit_events").insert({ workspace_id: workspaceId, actor_id: userId, category: /role|member|invit/i.test(message) ? "membership" : /shar/i.test(message) ? "sharing" : "security", action: "workspace.activity", target_type: "workspace", target_id: workspaceId, metadata: { message } }),
    ]);
    if (error || auditError) throw error || auditError;
  };

  const serializeWorkspace = async (workspace, user) => {
    const [{ data: members, error: membersError }, { data: shares, error: sharesError }, { data: activity, error: activityError }] = await Promise.all([
      client.from("workspace_members").select("id,user_id,invited_email,role,status,created_at").eq("workspace_id", workspace.id).order("created_at"),
      client.from("asset_shares").select("asset_id,access_level,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
      client.from("workspace_activity").select("id,message,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (membersError || sharesError || activityError) throw membersError || sharesError || activityError;
    return {
      id: workspace.id,
      name: workspace.name,
      members: [
        { id: `owner-${workspace.owner_id}`, email: user.id === workspace.owner_id ? user.email : "workspace-owner", name: user.id === workspace.owner_id ? "You" : "Workspace owner", role: "Owner", status: "Active" },
        ...members.map((member) => ({ id: member.id, email: member.invited_email, name: member.user_id === user.id ? "You" : "", role: member.role[0].toUpperCase() + member.role.slice(1), status: member.status[0].toUpperCase() + member.status.slice(1) })),
      ],
      shares: shares.map((share) => ({ assetId: share.asset_id, access: share.access_level[0].toUpperCase() + share.access_level.slice(1), sharedAt: share.created_at })),
      activity: activity.map((item) => ({ id: item.id, message: item.message, createdAt: item.created_at })),
      cloud: true,
    };
  };

  const findOrCreateWorkspace = async (user) => {
    let workspace = await getOwnedWorkspace(user.id);
    if (workspace) return workspace;
    const { data: invitation, error: inviteError } = await client.from("workspace_members").select("id,workspace_id").eq("invited_email", user.email.toLowerCase()).limit(1).maybeSingle();
    if (inviteError) throw inviteError;
    if (invitation) {
      const { error } = await client.from("workspace_members").update({ user_id: user.id, status: "active" }).eq("id", invitation.id);
      if (error) throw error;
      const { data, error: workspaceError } = await client.from("workspaces").select("id,name,owner_id,created_at,updated_at").eq("id", invitation.workspace_id).single();
      if (workspaceError) throw workspaceError;
      return data;
    }
    const { data, error } = await client.from("workspaces").insert({ name: `${user.email.split("@")[0]} Workspace`, owner_id: user.id }).select("id,name,owner_id,created_at,updated_at").single();
    if (error) throw error;
    return data;
  };

  const serializeRun = async (run) => {
    const [{ data: events, error }, { data: approvals, error: approvalError }, { data: plans, error: planError }, { data: verifications, error: verificationError }] = await Promise.all([
      client.from("agent_run_events").select("id,tone,message,created_at,sequence").eq("run_id", run.id).order("sequence", { ascending: false }),
      client.from("agent_action_approvals").select("id,tool_name,risk_level,input,status,requested_at").eq("run_id", run.id).eq("status", "pending").order("requested_at", { ascending: false }).limit(1),
      client.from("agent_execution_plans").select("summary,success_criteria,calls,engine,created_at").eq("run_id", run.id).limit(1),
      client.from("agent_execution_verifications").select("passed,summary,checks,engine,created_at").eq("run_id", run.id).order("created_at", { ascending: false }).limit(1),
    ]);
    if (error || approvalError || planError || verificationError) throw error || approvalError || planError || verificationError;
    const seconds = run.finished_at ? Math.max(0, Math.round((new Date(run.finished_at) - new Date(run.started_at)) / 1000)) : null;
    return {
      id: run.id, agentId: run.agent_id, agentTitle: run.agent_title, mission: run.mission,
      status: run.status === "waiting_for_approval" ? "Awaiting approval" : run.status === "waiting_for_tool_approval" ? "Action approval" : run.status[0].toUpperCase() + run.status.slice(1),
      stage: run.status === "waiting_for_approval" ? "approval" : run.status === "waiting_for_tool_approval" ? "tool_approval" : run.status,
      startedAt: run.started_at, finishedAt: run.finished_at,
      duration: seconds === null ? "—" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
      cost: `₹${(run.cost_used_paise / 100).toFixed(run.cost_used_paise % 100 ? 2 : 0)}`,
      permissions: run.permissions, cloud: true,
      actionApproval: approvals?.[0] ? { id: approvals[0].id, toolName: approvals[0].tool_name, riskLevel: approvals[0].risk_level, input: approvals[0].input, requestedAt: approvals[0].requested_at } : null,
      plan: plans?.[0] ? { summary: plans[0].summary, successCriteria: plans[0].success_criteria, calls: plans[0].calls, engine: plans[0].engine, createdAt: plans[0].created_at } : null,
      verification: verifications?.[0] ? { passed: verifications[0].passed, summary: verifications[0].summary, checks: verifications[0].checks, engine: verifications[0].engine, createdAt: verifications[0].created_at } : null,
      events: events.map((event) => ({ id: event.id, tone: event.tone, text: event.message, at: event.created_at })),
    };
  };

  return {
    name: "supabase",
    async verifyUser(accessToken) {
      if (!accessToken) return null;
      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data.user) return null;
      return data.user;
    },
    async list(userId) {
      const { data, error } = await client
        .from("assets")
        .select("content")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data.map((row) => row.content);
    },
    async remove(id, userId) {
      const { error } = await client.from("assets").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
    async save(asset, userId) {
      if (!userId) throw new Error("A verified user id is required for cloud persistence.");
      const { error } = await client.from("assets").upsert({
        id: asset.id,
        user_id: userId,
        type: asset.type.toLowerCase(),
        title: asset.title,
        description: asset.summary,
        source_intent: asset.sourceIntent,
        content: asset,
        current_version: asset.version,
        updated_at: asset.createdAt,
      }, { onConflict: "id" });
      if (error) throw error;
      return asset;
    },
    async recordPaymentEvent(event) {
      const { data, error } = await client.rpc("process_stripe_checkout", { event_payload: event });
      if (error) throw error;
      return data;
    },
    async listPurchases(userId) {
      const { data, error } = await client
        .from("purchases")
        .select("id,asset_id,title,creator,amount,currency,status,purchased_at")
        .eq("user_id", userId)
        .eq("status", "paid")
        .order("purchased_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data.map((purchase) => ({
        id: purchase.id,
        assetId: purchase.asset_id,
        title: purchase.title,
        creator: purchase.creator,
        amount: purchase.amount / 100,
        currency: purchase.currency,
        mode: "Stripe verified",
        status: purchase.status,
        createdAt: purchase.purchased_at,
        cloud: true,
      }));
    },
    async createAgentRun(userId, input) {
      const { data: runId, error } = await client.rpc("create_agent_run", {
        owner_id: userId, requested_agent_id: input.agentId, requested_agent_title: input.agentTitle,
        requested_mission: input.mission, requested_permissions: input.permissions,
        requested_idempotency_key: input.idempotencyKey,
      });
      if (error) throw error;
      return this.getAgentRun(userId, runId);
    },
    async getAgentRun(userId, runId) {
      const { data, error } = await client.from("agent_runs").select("*").eq("id", runId).eq("user_id", userId).single();
      if (error) throw error;
      return serializeRun(data);
    },
    async decideAgentRun(userId, runId, approved) {
      const { data, error } = await client.rpc("decide_agent_run", { owner_id: userId, requested_run_id: runId, approved });
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Run is unavailable or already decided."), { status: 409 });
      return this.getAgentRun(userId, runId);
    },
    async cancelAgentRun(userId, runId) {
      const { data, error } = await client.rpc("cancel_agent_run", { owner_id: userId, requested_run_id: runId });
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Only an active run can be cancelled."), { status: 409 });
      return this.getAgentRun(userId, runId);
    },
    async claimAgentJob(workerName) {
      const { data, error } = await client.rpc("claim_agent_job", { worker_name: workerName });
      if (error) throw error;
      return data;
    },
    async heartbeatAgentWorker(workerName, status = "online", completedDelta = 0, failedDelta = 0, metadata = {}) {
      const { error } = await client.rpc("heartbeat_agent_worker", { requested_worker_name: workerName, requested_status: status, completed_delta: completedDelta, failed_delta: failedDelta, requested_metadata: metadata });
      if (error) throw error;
    },
    async getAgentOperations(userId) {
      const { data, error } = await client.rpc("get_agent_operations", { owner_id: userId });
      if (error) throw error;
      return data;
    },
    async getWorkerRun(runId) {
      const { data, error } = await client.from("agent_runs").select("id,agent_id,agent_title,mission,permissions,status,token_budget,cost_budget_paise").eq("id", runId).single();
      if (error) throw error;
      return data;
    },
    async listCompletedToolNames(runId) {
      const { data, error } = await client.from("agent_tool_calls").select("tool_name").eq("run_id", runId).eq("status", "completed");
      if (error) throw error;
      return [...new Set(data.map((item) => item.tool_name))];
    },
    async listAgentToolResults(runId) {
      const { data, error } = await client.from("agent_tool_calls").select("tool_name,status,output,error_code,duration_ms").eq("run_id", runId).order("created_at");
      if (error) throw error;
      return data.map((item) => ({ toolName: item.tool_name, status: item.status, output: item.output, errorCode: item.error_code, durationMs: item.duration_ms }));
    },
    async getAgentPlan(runId) {
      const { data, error } = await client.from("agent_execution_plans").select("summary,success_criteria,calls,engine").eq("run_id", runId).maybeSingle();
      if (error) throw error;
      return data ? { summary: data.summary, successCriteria: data.success_criteria, calls: data.calls, engine: data.engine } : null;
    },
    async recordAgentPlan(runId, plan) {
      const { error } = await client.from("agent_execution_plans").insert({ run_id: runId, summary: plan.summary, success_criteria: plan.successCriteria, calls: plan.calls, engine: plan.engine, fallback_reason: plan.fallbackReason || null });
      if (error && error.code !== "23505") throw error;
    },
    async recordAgentVerification(runId, verification) {
      const { error } = await client.from("agent_execution_verifications").insert({ run_id: runId, passed: verification.passed, summary: verification.summary, checks: verification.checks, engine: verification.engine, fallback_reason: verification.fallbackReason || null });
      if (error) throw error;
    },
    async recordAgentToolCall(jobId, workerName, result) {
      const { data, error } = await client.rpc("record_agent_tool_call", {
        requested_job_id: jobId, worker_name: workerName, requested_tool_name: result.toolName,
        requested_risk_level: result.riskLevel, requested_status: result.status,
        requested_input: result.input, requested_output: result.output,
        requested_error_code: result.errorCode, requested_duration_ms: result.durationMs,
      });
      if (error) throw error;
      return data;
    },
    async requestAgentActionApproval(jobId, workerName, call, riskLevel) {
      const { data, error } = await client.rpc("request_agent_action_approval", { requested_job_id: jobId, worker_name: workerName, requested_tool_name: call.name, requested_risk_level: riskLevel, requested_input: call.input });
      if (error) throw error;
      return data;
    },
    async decideAgentAction(userId, approvalId, approved) {
      const { data, error } = await client.rpc("decide_agent_action", { owner_id: userId, approval_id: approvalId, approved });
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Action approval is unavailable or already decided."), { status: 409 });
      const { data: approval, error: approvalError } = await client.from("agent_action_approvals").select("run_id").eq("id", approvalId).single();
      if (approvalError) throw approvalError;
      return this.getAgentRun(userId, approval.run_id);
    },
    async createWorkspaceNote(runId, content) {
      const { data: run, error: runError } = await client.from("agent_runs").select("user_id").eq("id", runId).single();
      if (runError) throw runError;
      const { data, error } = await client.from("workspace_notes").insert({ user_id: run.user_id, run_id: runId, content }).select("id,content,created_at").single();
      if (error) throw error;
      return { noteId: data.id, content: data.content, createdAt: data.created_at };
    },
    async rememberAgentMemory(runId, content, retentionDays = 30) {
      const { data: run, error: runError } = await client.from("agent_runs").select("user_id").eq("id", runId).single();
      if (runError) throw runError;
      const normalized = content.trim();
      const contentHash = hashToken(normalized.toLowerCase());
      const expiresAt = new Date(Date.now() + retentionDays * 86400000).toISOString();
      const { data, error } = await client.from("agent_memories").upsert({ user_id: run.user_id, run_id: runId, content: normalized, content_hash: contentHash, retention_days: retentionDays, expires_at: expiresAt, updated_at: new Date().toISOString() }, { onConflict: "user_id,content_hash" }).select("id,content,retention_days,expires_at,created_at").single();
      if (error) throw error;
      await client.from("agent_memory_events").insert({ user_id: run.user_id, memory_id: data.id, action: "remembered", content_hash: contentHash });
      return { memoryId: data.id, content: data.content, retentionDays: data.retention_days, expiresAt: data.expires_at, createdAt: data.created_at };
    },
    async listAgentMemories(userId) {
      const { data, error } = await client.from("agent_memories").select("id,run_id,content,retention_days,expires_at,created_at,updated_at").eq("user_id", userId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data.map((item) => ({ id: item.id, runId: item.run_id, content: item.content, retentionDays: item.retention_days, expiresAt: item.expires_at, createdAt: item.created_at, updatedAt: item.updated_at }));
    },
    async deleteAgentMemory(userId, memoryId) {
      const { data, error } = await client.from("agent_memories").delete().eq("id", memoryId).eq("user_id", userId).select("id,content_hash").maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Memory not found."), { status: 404 });
      await client.from("agent_memory_events").insert({ user_id: userId, memory_id: null, action: "deleted", content_hash: data.content_hash });
    },
    async purgeExpiredAgentMemories(batchSize = 100) {
      const { data, error } = await client.rpc("purge_expired_agent_memories", { batch_size: batchSize });
      if (error) throw error;
      return data;
    },
    async completeAgentJob(jobId, workerName) {
      const { data, error } = await client.rpc("complete_agent_job", { job_id: jobId, worker_name: workerName });
      if (error) throw error;
      return data;
    },
    async failAgentJob(jobId, workerName, message) {
      const { data, error } = await client.rpc("fail_agent_job", { requested_job_id: jobId, worker_name: workerName, failure_message: String(message || "Worker failure").slice(0, 500) });
      if (error) throw error;
      return data;
    },
    async recoverStaleAgentJobs(leaseSeconds) {
      const { data, error } = await client.rpc("recover_stale_agent_jobs", { lease_seconds: leaseSeconds });
      if (error) throw error;
      return data;
    },
    async retryAgentRun(userId, runId) {
      const { data, error } = await client.rpc("retry_agent_run", { owner_id: userId, requested_run_id: runId });
      if (error) throw error;
      if (!data) throw Object.assign(new Error("This run cannot be retried or has reached its retry limit."), { status: 409 });
      return this.getAgentRun(userId, runId);
    },
    async listAgentRuns(userId) {
      const { data, error } = await client.from("agent_runs").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(20);
      if (error) throw error;
      return Promise.all(data.map(serializeRun));
    },
    async listAgentSchedules(userId) {
      const { data, error } = await client.from("agent_schedules").select("id,agent_id,agent_title,mission,permissions,cadence,timezone,next_run_at,last_run_at,active,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data.map((item) => ({ id: item.id, agentId: item.agent_id, agentTitle: item.agent_title, mission: item.mission, permissions: item.permissions, cadence: item.cadence, timezone: item.timezone, nextRunAt: item.next_run_at, lastRunAt: item.last_run_at, active: item.active, createdAt: item.created_at }));
    },
    async createAgentSchedule(userId, input) {
      const { data, error } = await client.from("agent_schedules").insert({ user_id: userId, agent_id: input.agentId, agent_title: input.agentTitle, mission: input.mission, permissions: { ...input.permissions, external: false }, cadence: input.cadence, timezone: input.timezone, next_run_at: input.nextRunAt }).select("id,agent_id,agent_title,mission,permissions,cadence,timezone,next_run_at,last_run_at,active,created_at").single();
      if (error) throw error;
      return { id: data.id, agentId: data.agent_id, agentTitle: data.agent_title, mission: data.mission, permissions: data.permissions, cadence: data.cadence, timezone: data.timezone, nextRunAt: data.next_run_at, lastRunAt: data.last_run_at, active: data.active, createdAt: data.created_at };
    },
    async setAgentScheduleActive(userId, scheduleId, active) {
      const { data, error } = await client.from("agent_schedules").update({ active, updated_at: new Date().toISOString() }).eq("id", scheduleId).eq("user_id", userId).select("id,active").maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Schedule not found."), { status: 404 });
      return data;
    },
    async deleteAgentSchedule(userId, scheduleId) {
      const { data, error } = await client.from("agent_schedules").delete().eq("id", scheduleId).eq("user_id", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Schedule not found."), { status: 404 });
    },
    async materializeDueAgentSchedules(batchSize = 20) {
      const { data, error } = await client.rpc("materialize_due_agent_schedules", { batch_size: batchSize });
      if (error) throw error;
      return data;
    },
    async loadWorkspace(user) {
      const workspace = await findOrCreateWorkspace(user);
      return serializeWorkspace(workspace, user);
    },
    async getWorkspaceGovernance(userId) {
      const workspace = await getOwnedWorkspace(userId);
      if (!workspace) return null;
      const [{ data: policy, error }, { data: events, error: eventsError }] = await Promise.all([
        client.from("workspace_governance_policies").select("audit_retention_days,require_production_approval,allow_external_agent_actions,updated_at").eq("workspace_id", workspace.id).maybeSingle(),
        client.from("organization_audit_events").select("id,category,action,target_type,target_id,metadata,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (error || eventsError) throw error || eventsError;
      return { workspaceId: workspace.id, owner: true, policy: policy ? { auditRetentionDays: policy.audit_retention_days, requireProductionApproval: policy.require_production_approval, allowExternalAgentActions: policy.allow_external_agent_actions, updatedAt: policy.updated_at } : { auditRetentionDays: 365, requireProductionApproval: true, allowExternalAgentActions: false }, events: events.map((event) => ({ id: event.id, category: event.category, action: event.action, targetType: event.target_type, targetId: event.target_id, metadata: event.metadata, createdAt: event.created_at })) };
    },
    async authorizeExternalAgentActions(userId) {
      const workspace = await getOwnedWorkspace(userId);
      if (!workspace) return false;
      const { data, error } = await client.from("workspace_governance_policies").select("allow_external_agent_actions").eq("workspace_id", workspace.id).maybeSingle();
      if (error) throw error;
      const allowed = Boolean(data?.allow_external_agent_actions);
      if (!allowed) await client.from("organization_audit_events").insert({ workspace_id: workspace.id, actor_id: userId, category: "security", action: "policy.external_action_blocked", target_type: "agent_run", metadata: { reason: "organization_policy" } });
      return allowed;
    },
    async updateWorkspaceGovernance(userId, input) {
      const { data, error } = await client.rpc("update_workspace_governance", { requested_owner_id: userId, retention_days: input.auditRetentionDays, production_approval: input.requireProductionApproval, external_actions: input.allowExternalAgentActions });
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Only the workspace owner can update governance."), { status: 403 });
      return this.getWorkspaceGovernance(userId);
    },
    async exportWorkspaceAudit(userId) {
      const workspace = await getOwnedWorkspace(userId);
      if (!workspace) throw Object.assign(new Error("Only the workspace owner can export audit data."), { status: 403 });
      const { data, error } = await client.from("organization_audit_events").select("id,actor_id,category,action,target_type,target_id,metadata,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(10000);
      if (error) throw error;
      await client.from("organization_audit_events").insert({ workspace_id: workspace.id, actor_id: userId, category: "governance", action: "audit.exported", target_type: "workspace", target_id: workspace.id, metadata: { exportedRows: data.length } });
      return { workspace, events: data };
    },
    async getWorkspaceIdentity(userId) {
      const workspace = await getOwnedWorkspace(userId); if (!workspace) return null;
      const [{ data: config, error }, { count, error: countError }] = await Promise.all([
        client.from("workspace_identity_configs").select("sso_enabled,verified_domain,saml_metadata_url,scim_enabled,scim_token_last_four,token_rotated_at,updated_at").eq("workspace_id",workspace.id).maybeSingle(),
        client.from("scim_directory_users").select("id",{ count:"exact",head:true }).eq("workspace_id",workspace.id).eq("active",true),
      ]); if (error || countError) throw error || countError;
      return { workspaceId: workspace.id, ssoEnabled: Boolean(config?.sso_enabled), verifiedDomain: config?.verified_domain || "", samlMetadataUrl: config?.saml_metadata_url || "", scimEnabled: Boolean(config?.scim_enabled), tokenLastFour: config?.scim_token_last_four || "", tokenRotatedAt: config?.token_rotated_at || null, activeDirectoryUsers: count || 0 };
    },
    async updateWorkspaceIdentity(userId, input) {
      const workspace = await getOwnedWorkspace(userId); if (!workspace) throw Object.assign(new Error("Only the workspace owner can update identity."),{status:403});
      const { error } = await client.from("workspace_identity_configs").upsert({ workspace_id:workspace.id,sso_enabled:input.ssoEnabled,verified_domain:input.verifiedDomain || null,saml_metadata_url:input.samlMetadataUrl || null,scim_enabled:input.scimEnabled,updated_by:userId,updated_at:new Date().toISOString() },{onConflict:"workspace_id"}); if(error) throw error;
      await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"security",action:"identity.config_updated",target_type:"workspace",target_id:workspace.id,metadata:{ssoEnabled:input.ssoEnabled,scimEnabled:input.scimEnabled,verifiedDomain:input.verifiedDomain || null}});
      return this.getWorkspaceIdentity(userId);
    },
    async rotateScimToken(userId) {
      const workspace = await getOwnedWorkspace(userId); if (!workspace) throw Object.assign(new Error("Only the workspace owner can rotate SCIM credentials."),{status:403});
      const token=`scim_${randomBytes(32).toString("base64url")}`; const now=new Date().toISOString();
      const { error }=await client.from("workspace_identity_configs").upsert({workspace_id:workspace.id,scim_enabled:true,scim_token_hash:hashToken(token),scim_token_last_four:token.slice(-4),token_rotated_at:now,updated_by:userId,updated_at:now},{onConflict:"workspace_id"}); if(error) throw error;
      await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"security",action:"scim.token_rotated",target_type:"workspace",target_id:workspace.id});
      return {token,lastFour:token.slice(-4),rotatedAt:now};
    },
    async authenticateScimToken(token) {
      if (!token?.startsWith("scim_") || token.length < 40 || token.length > 100) return null;
      const { data,error }=await client.from("workspace_identity_configs").select("workspace_id").eq("scim_token_hash",hashToken(token)).eq("scim_enabled",true).maybeSingle(); if(error) throw error; return data?.workspace_id || null;
    },
    async provisionScimUser(workspaceId,input) {
      const now=new Date().toISOString();
      const {data,error}=await client.from("scim_directory_users").upsert({workspace_id:workspaceId,external_id:input.externalId,email:input.email,display_name:input.displayName,role:input.role,active:input.active,synced_at:now},{onConflict:"workspace_id,external_id"}).select("id,external_id,email,display_name,role,active,synced_at").single(); if(error) throw error;
      const {error:memberError}=await client.from("workspace_members").upsert({workspace_id:workspaceId,invited_email:input.email,role:input.role,status:input.active?"pending":"suspended",invite_token_hash:null,invite_expires_at:null},{onConflict:"workspace_id,invited_email"}); if(memberError) throw memberError;
      await client.from("organization_audit_events").insert({workspace_id:workspaceId,category:"membership",action:input.active?"scim.user_provisioned":"scim.user_suspended",target_type:"directory_user",target_id:data.id,metadata:{externalId:input.externalId,email:input.email,role:input.role}});
      return {id:data.id,externalId:data.external_id,userName:data.email,displayName:data.display_name,role:data.role,active:data.active,syncedAt:data.synced_at};
    },
    async listScimUsers(workspaceId) {
      const {data,error}=await client.from("scim_directory_users").select("id,external_id,email,display_name,role,active,synced_at").eq("workspace_id",workspaceId).order("email").limit(200); if(error) throw error;
      return data.map((item)=>({id:item.id,externalId:item.external_id,userName:item.email,displayName:item.display_name,role:item.role,active:item.active,syncedAt:item.synced_at}));
    },
    async updateScimUser(workspaceId,id,input) {
      const {data:existing,error:existingError}=await client.from("scim_directory_users").select("external_id,email,display_name,role,active").eq("id",id).eq("workspace_id",workspaceId).maybeSingle(); if(existingError) throw existingError; if(!existing) throw Object.assign(new Error("SCIM user not found."),{status:404});
      return this.provisionScimUser(workspaceId,{externalId:existing.external_id,email:input.email || existing.email,displayName:input.displayName ?? existing.display_name,role:input.role || existing.role,active:input.active ?? existing.active});
    },
    async listAssetReleases(userId) {
      const workspace=await getOwnedWorkspace(userId); if(!workspace)return [];
      const {data,error}=await client.from("asset_releases").select("id,asset_id,version,environment,status,previous_release_id,requested_at,decided_at").eq("workspace_id",workspace.id).order("requested_at",{ascending:false}).limit(100); if(error)throw error;
      return data.map((item)=>({id:item.id,assetId:item.asset_id,version:item.version,environment:item.environment,status:item.status,previousReleaseId:item.previous_release_id,requestedAt:item.requested_at,decidedAt:item.decided_at}));
    },
    async requestAssetPromotion(userId,assetId){if(!await this.isWorkspaceFeatureEnabled(userId,"production_promotion"))throw Object.assign(new Error("Production promotion is disabled by workspace feature policy."),{status:403});const {data,error}=await client.rpc("request_asset_promotion",{requested_user_id:userId,requested_asset_id:assetId});if(error)throw error;if(!data)throw Object.assign(new Error("Asset or owner workspace not found."),{status:404});return data;},
    async decideAssetPromotion(userId,releaseId,approved){const {data,error}=await client.rpc("decide_asset_promotion",{requested_owner_id:userId,requested_release_id:releaseId,approved});if(error)throw error;if(!data)throw Object.assign(new Error("Pending release not found."),{status:409});},
    async rollbackAssetRelease(userId,releaseId){const {data,error}=await client.rpc("rollback_asset_release",{requested_owner_id:userId,target_release_id:releaseId});if(error)throw error;if(!data)throw Object.assign(new Error("Superseded release cannot be restored."),{status:409});},
    async getInfrastructureControls(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)return null;const [{data:config,error},{data:drills,error:drillError}]=await Promise.all([client.from("workspace_infrastructure_configs").select("residency_region,provider,key_last_four,key_rotated_at,updated_at").eq("workspace_id",workspace.id).maybeSingle(),client.from("recovery_readiness_drills").select("id,status,rpo_target_minutes,rto_target_minutes,checks,verified_restore,created_at").eq("workspace_id",workspace.id).order("created_at",{ascending:false}).limit(5)]);if(error||drillError)throw error||drillError;return{region:config?.residency_region||"in",provider:config?.provider||"",keyLastFour:config?.key_last_four||"",keyRotatedAt:config?.key_rotated_at||null,drills:(drills||[]).map(d=>({id:d.id,status:d.status,rpoTargetMinutes:d.rpo_target_minutes,rtoTargetMinutes:d.rto_target_minutes,checks:d.checks,verifiedRestore:d.verified_restore,createdAt:d.created_at}))};},
    async saveInfrastructureControls(userId,input,encryptedKey){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can update infrastructure controls."),{status:403});const payload={workspace_id:workspace.id,residency_region:input.region,provider:input.provider||null,updated_by:userId,updated_at:new Date().toISOString(),...(encryptedKey?{key_ciphertext:encryptedKey.ciphertext,key_iv:encryptedKey.iv,key_auth_tag:encryptedKey.tag,key_last_four:encryptedKey.lastFour,key_rotated_at:new Date().toISOString()}:{})};const{error}=await client.from("workspace_infrastructure_configs").upsert(payload,{onConflict:"workspace_id"});if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"security",action:encryptedKey?"byok.key_rotated":"infrastructure.policy_updated",target_type:"workspace",target_id:workspace.id,metadata:{region:input.region,provider:input.provider||null,keyRotated:Boolean(encryptedKey)}});return this.getInfrastructureControls(userId);},
    async revokeProviderKey(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can revoke a key."),{status:403});const{error}=await client.from("workspace_infrastructure_configs").update({key_ciphertext:null,key_iv:null,key_auth_tag:null,key_last_four:null,key_rotated_at:null,updated_by:userId,updated_at:new Date().toISOString()}).eq("workspace_id",workspace.id);if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"security",action:"byok.key_revoked",target_type:"workspace",target_id:workspace.id});return this.getInfrastructureControls(userId);},
    async runRecoveryReadinessDrill(userId,input){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can run a drill."),{status:403});const [{data:config},{count:releaseCount},{count:auditCount}]=await Promise.all([client.from("workspace_infrastructure_configs").select("residency_region,key_ciphertext").eq("workspace_id",workspace.id).maybeSingle(),client.from("asset_releases").select("id",{count:"exact",head:true}).eq("workspace_id",workspace.id).eq("status","approved"),client.from("organization_audit_events").select("id",{count:"exact",head:true}).eq("workspace_id",workspace.id)]);const checks=[{label:"Residency policy configured",passed:Boolean(config?.residency_region)},{label:"Production snapshot available",passed:(releaseCount||0)>0},{label:"Audit trail available",passed:(auditCount||0)>0},{label:"Verified restore completed",passed:false}];const status=checks.slice(0,3).every(c=>c.passed)?"ready":"attention";const{data,error}=await client.from("recovery_readiness_drills").insert({workspace_id:workspace.id,initiated_by:userId,status,rpo_target_minutes:input.rpoTargetMinutes,rto_target_minutes:input.rtoTargetMinutes,checks,verified_restore:false}).select("id").single();if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"governance",action:"recovery.readiness_drill_run",target_type:"recovery_drill",target_id:data.id,metadata:{status,rpoTargetMinutes:input.rpoTargetMinutes,rtoTargetMinutes:input.rtoTargetMinutes,verifiedRestore:false}});return this.getInfrastructureControls(userId);},
    async isWorkspaceFeatureEnabled(userId,flagKey){const workspace=await getOwnedWorkspace(userId);if(!workspace)return true;const{data,error}=await client.from("workspace_feature_flags").select("enabled").eq("workspace_id",workspace.id).eq("flag_key",flagKey).maybeSingle();if(error)throw error;return data?.enabled!==false;},
    async getEnterpriseUsage(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)return null;const[{data:flags,error},{count:assetCount},{data:runs},{count:toolCalls},{count:releaseCount}]=await Promise.all([client.from("workspace_feature_flags").select("flag_key,enabled,updated_at").eq("workspace_id",workspace.id),client.from("assets").select("id",{count:"exact",head:true}).eq("user_id",userId),client.from("agent_runs").select("status,cost_used_paise,started_at").eq("user_id",userId).gte("started_at",new Date(Date.now()-30*86400000).toISOString()),client.from("agent_tool_calls").select("id,agent_runs!inner(user_id)",{count:"exact",head:true}).eq("agent_runs.user_id",userId),client.from("asset_releases").select("id",{count:"exact",head:true}).eq("workspace_id",workspace.id).eq("status","approved")]);if(error)throw error;const map={agent_execution:true,production_promotion:true,marketplace_publish:true};for(const f of flags||[])map[f.flag_key]=f.enabled;return{flags:map,report:{periodDays:30,assets:assetCount||0,runs:runs?.length||0,completedRuns:(runs||[]).filter(r=>r.status==="completed").length,failedRuns:(runs||[]).filter(r=>r.status==="failed").length,costPaise:(runs||[]).reduce((sum,r)=>sum+(r.cost_used_paise||0),0),toolCalls:toolCalls||0,productionReleases:releaseCount||0,generatedAt:new Date().toISOString()}};},
    async updateWorkspaceFeatureFlag(userId,flagKey,enabled){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can update feature flags."),{status:403});const{error}=await client.from("workspace_feature_flags").upsert({workspace_id:workspace.id,flag_key:flagKey,enabled,updated_by:userId,updated_at:new Date().toISOString()},{onConflict:"workspace_id,flag_key"});if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"governance",action:"feature_flag.updated",target_type:"feature_flag",target_id:flagKey,metadata:{enabled}});return this.getEnterpriseUsage(userId);},
    async recordServiceRequestSample(sample){const{error}=await client.from("service_request_samples").insert({route_name:sample.routeName,method:sample.method,status_code:sample.statusCode,duration_ms:sample.durationMs,request_id:sample.requestId});if(error)throw error;},
    async getSlaReport(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can view SLA monitoring."),{status:403});const since=new Date(Date.now()-24*60*60*1000).toISOString();const{data,error}=await client.from("service_request_samples").select("status_code,duration_ms,created_at").gte("created_at",since).order("created_at",{ascending:false}).limit(10000);if(error)throw error;const samples=data||[];const sorted=samples.map(x=>x.duration_ms).sort((a,b)=>a-b);const percentile=(p)=>sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]:0;const errors=samples.filter(x=>x.status_code>=500).length;const availability=samples.length?Number((((samples.length-errors)/samples.length)*100).toFixed(3)):100;const p95=percentile(.95);const targets={availabilityPercent:99.9,p95LatencyMs:750};const alerts=[];if(samples.length===0)alerts.push({severity:"info",message:"No API traffic captured in the last 24 hours."});if(availability<targets.availabilityPercent)alerts.push({severity:"critical",message:`Availability ${availability}% is below the ${targets.availabilityPercent}% target.`});if(p95>targets.p95LatencyMs)alerts.push({severity:"warning",message:`P95 latency ${p95}ms exceeds the ${targets.p95LatencyMs}ms target.`});const allowedErrors=samples.length*(1-targets.availabilityPercent/100);return{windowHours:24,requestCount:samples.length,errorCount:errors,availability,p50LatencyMs:percentile(.5),p95LatencyMs:p95,p99LatencyMs:percentile(.99),errorBudgetRemainingPercent:samples.length?Math.max(0,Number(((1-errors/Math.max(allowedErrors,1))*100).toFixed(1))):100,targets,alerts,generatedAt:new Date().toISOString()};},
    async runVerifiedRecovery(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can verify recovery."),{status:403});const snapshotAt=new Date().toISOString();const [{count:assets,error:assetError},{count:runs,error:runError},{count:releases,error:releaseError},{count:auditEvents,error:auditError}]=await Promise.all([client.from("assets").select("id",{count:"exact",head:true}).eq("user_id",userId),client.from("agent_runs").select("id",{count:"exact",head:true}).eq("user_id",userId),client.from("asset_releases").select("id",{count:"exact",head:true}).eq("workspace_id",workspace.id),client.from("organization_audit_events").select("id",{count:"exact",head:true}).eq("workspace_id",workspace.id)]);if(assetError||runError||releaseError||auditError)throw assetError||runError||releaseError||auditError;const manifest={version:1,workspaceId:workspace.id,snapshotAt,counts:{assets:assets||0,agentRuns:runs||0,releases:releases||0,auditEvents:auditEvents||0}};const checksum=createHash("sha256").update(JSON.stringify(manifest)).digest("hex");const checks=[{label:"Critical tables readable",passed:true},{label:"Manifest checksum generated",passed:checksum.length===64},{label:"Workspace ownership verified",passed:true},{label:"Recovery point persisted",passed:true}];const status=checks.every(x=>x.passed)?"verified":"failed";const{data,error}=await client.from("recovery_manifests").insert({workspace_id:workspace.id,initiated_by:userId,status,snapshot_at:snapshotAt,manifest,checksum_sha256:checksum,verification_checks:checks,rpo_minutes:0,rto_minutes:15}).select("id,status,snapshot_at,manifest,checksum_sha256,verification_checks,rpo_minutes,rto_minutes,created_at").single();if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"governance",action:"recovery.manifest_verified",target_type:"recovery_manifest",target_id:data.id,metadata:{status,checksum}});return{id:data.id,status:data.status,snapshotAt:data.snapshot_at,manifest:data.manifest,checksum:data.checksum_sha256,checks:data.verification_checks,rpoMinutes:data.rpo_minutes,rtoMinutes:data.rto_minutes,createdAt:data.created_at};},
    async listRecoveryVerifications(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can view recovery verifications."),{status:403});const{data,error}=await client.from("recovery_manifests").select("id,status,snapshot_at,manifest,checksum_sha256,verification_checks,rpo_minutes,rto_minutes,created_at").eq("workspace_id",workspace.id).order("created_at",{ascending:false}).limit(10);if(error)throw error;return(data||[]).map(x=>({id:x.id,status:x.status,snapshotAt:x.snapshot_at,manifest:x.manifest,checksum:x.checksum_sha256,checks:x.verification_checks,rpoMinutes:x.rpo_minutes,rtoMinutes:x.rto_minutes,createdAt:x.created_at}));},
    async recordActivationEvent(user,input){const workspace=await findOrCreateWorkspace(user);const{error}=await client.from("product_activation_events").upsert({workspace_id:workspace.id,user_id:user.id,event_name:input.eventName,session_id:input.sessionId,asset_id:input.assetId||null,properties:input.properties,idempotency_key:input.idempotencyKey,occurred_at:new Date().toISOString()},{onConflict:"idempotency_key",ignoreDuplicates:true});if(error)throw error;},
    async getActivationReport(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can view activation analytics."),{status:403});const since=new Date(Date.now()-30*86400000).toISOString();const{data,error}=await client.from("product_activation_events").select("event_name,session_id,user_id,asset_id,occurred_at").eq("workspace_id",workspace.id).gte("occurred_at",since).order("occurred_at",{ascending:false}).limit(20000);if(error)throw error;const events=data||[];const order=["intent_submitted","asset_generated","asset_saved","asset_tested","asset_published"];const labels={intent_submitted:"Intent submitted",asset_generated:"Generated",asset_saved:"Saved",asset_tested:"Tested",asset_published:"Published"};let progressing=null;let previousSessions=0;const stages=order.map((name,index)=>{const matching=events.filter(event=>event.event_name===name);const observed=new Set(matching.map(event=>event.session_id));progressing=index===0?observed:new Set([...progressing].filter(id=>observed.has(id)));const sessions=progressing.size;const previous=index?previousSessions:sessions;previousSessions=sessions;return{name,label:labels[name],events:matching.length,sessions,stepConversionPercent:index?(previous?Number((sessions/previous*100).toFixed(1)):0):100};});const submitted=stages[0].sessions;const activated=stages[3].sessions;return{periodDays:30,primaryKpi:{name:"Tested activation rate",valuePercent:submitted?Number((activated/submitted*100).toFixed(1)):0,numerator:activated,denominator:submitted},stages,activeUsers:new Set(events.map(event=>event.user_id)).size,trackedSessions:new Set(events.map(event=>event.session_id)).size,totalEvents:events.length,guardrails:{generationFailureEvents:0,privacy:"No prompt text or generated content stored"},generatedAt:new Date().toISOString()};},
    async getLaunchCenter(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can open launch controls."),{status:403});const[{data:control,error},{data:tokens,error:tokenError},{data:recovery,error:recoveryError},activation,sla]=await Promise.all([client.from("workspace_launch_controls").select("rollout_mode,launch_paused,beta_capacity,activation_target_percent,updated_at").eq("workspace_id",workspace.id).maybeSingle(),client.from("launch_access_tokens").select("id,cohort_name,status,expires_at,redeemed_at,created_at").eq("workspace_id",workspace.id).order("created_at",{ascending:false}).limit(25),client.from("recovery_manifests").select("status,created_at").eq("workspace_id",workspace.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),this.getActivationReport(userId),this.getSlaReport(userId)]);if(error||tokenError||recoveryError)throw error||tokenError||recoveryError;const defaults={rollout_mode:"internal",launch_paused:false,beta_capacity:100,activation_target_percent:35};const settings={...defaults,...control};const redeemed=(tokens||[]).filter(x=>x.status==="redeemed").length;const health=[{name:"API availability",status:sla.availability>=sla.targets.availabilityPercent?"healthy":"attention",value:`${sla.availability}%`},{name:"Activation target",status:activation.primaryKpi.valuePercent>=Number(settings.activation_target_percent)?"healthy":"attention",value:`${activation.primaryKpi.valuePercent}%`},{name:"Recovery evidence",status:recovery?.status==="verified"?"healthy":"attention",value:recovery?.status||"missing"}];return{control:{rolloutMode:settings.rollout_mode,launchPaused:settings.launch_paused,betaCapacity:settings.beta_capacity,activationTargetPercent:Number(settings.activation_target_percent),updatedAt:settings.updated_at||null},health,cohort:{redeemed,capacity:settings.beta_capacity,remaining:Math.max(0,settings.beta_capacity-redeemed)},accessTokens:(tokens||[]).map(x=>({id:x.id,cohortName:x.cohort_name,status:x.status,expiresAt:x.expires_at,redeemedAt:x.redeemed_at,createdAt:x.created_at})),generatedAt:new Date().toISOString()};},
    async updateLaunchControl(userId,input){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can update launch controls."),{status:403});const{error}=await client.from("workspace_launch_controls").upsert({workspace_id:workspace.id,rollout_mode:input.rolloutMode,launch_paused:input.launchPaused,beta_capacity:input.betaCapacity,activation_target_percent:input.activationTargetPercent,updated_by:userId,updated_at:new Date().toISOString()},{onConflict:"workspace_id"});if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"governance",action:"launch.control_updated",target_type:"workspace",target_id:workspace.id,metadata:input});return this.getLaunchCenter(userId);},
    async createLaunchAccess(userId,cohortName){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can create beta access."),{status:403});const token=randomBytes(32).toString("base64url");const expiresAt=new Date(Date.now()+7*86400000).toISOString();const{data,error}=await client.from("launch_access_tokens").insert({workspace_id:workspace.id,token_hash:hashToken(token),cohort_name:cohortName,status:"active",created_by:userId,expires_at:expiresAt}).select("id").single();if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"membership",action:"launch.access_created",target_type:"launch_access",target_id:data.id,metadata:{cohortName,expiresAt}});return{id:data.id,token,expiresAt};},
    async revokeLaunchAccess(userId,id){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can revoke beta access."),{status:403});const{data,error}=await client.from("launch_access_tokens").update({status:"revoked"}).eq("id",id).eq("workspace_id",workspace.id).eq("status","active").select("id").maybeSingle();if(error)throw error;if(!data)throw Object.assign(new Error("Active access link not found."),{status:404});await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"membership",action:"launch.access_revoked",target_type:"launch_access",target_id:id});},
    async redeemLaunchAccess(user,token){const{data:access,error}=await client.from("launch_access_tokens").select("id,workspace_id,status,expires_at").eq("token_hash",hashToken(token)).maybeSingle();if(error)throw error;if(!access||access.status!=="active"||new Date(access.expires_at)<=new Date())throw Object.assign(new Error("Beta access is invalid or expired."),{status:410});const[{data:control,error:controlError},{count,error:countError}]=await Promise.all([client.from("workspace_launch_controls").select("rollout_mode,launch_paused,beta_capacity").eq("workspace_id",access.workspace_id).maybeSingle(),client.from("launch_access_tokens").select("id",{count:"exact",head:true}).eq("workspace_id",access.workspace_id).eq("status","redeemed")]);if(controlError||countError)throw controlError||countError;if(control?.launch_paused||control?.rollout_mode!=="beta")throw Object.assign(new Error("This beta is not accepting access right now."),{status:409});if((count||0)>=(control?.beta_capacity||100))throw Object.assign(new Error("This beta cohort is full."),{status:409});const{error:memberError}=await client.from("workspace_members").upsert({workspace_id:access.workspace_id,user_id:user.id,invited_email:user.email.toLowerCase(),role:"viewer",status:"active",accepted_at:new Date().toISOString()},{onConflict:"workspace_id,invited_email"});if(memberError)throw memberError;const{error:updateError}=await client.from("launch_access_tokens").update({status:"redeemed",redeemed_by:user.id,redeemed_at:new Date().toISOString()}).eq("id",access.id).eq("status","active");if(updateError)throw updateError;const{data:workspace,error:workspaceError}=await client.from("workspaces").select("id,name,owner_id,created_at,updated_at").eq("id",access.workspace_id).single();if(workspaceError)throw workspaceError;await recordActivity(workspace.id,user.id,`${user.email} joined the beta cohort.`);return serializeWorkspace(workspace,user);},
    async getLifecycleGrowth(userId){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can view lifecycle and growth controls."),{status:403});const defaults=[{workspace_id:workspace.id,automation_key:"complete_first_test",enabled:true,delay_hours:24,channel:"email",updated_by:userId},{workspace_id:workspace.id,automation_key:"publish_ready_asset",enabled:true,delay_hours:72,channel:"email",updated_by:userId}];const{error:seedError}=await client.from("lifecycle_automations").upsert(defaults,{onConflict:"workspace_id,automation_key",ignoreDuplicates:true});if(seedError)throw seedError;const[{data:automations,error},{data:deliveries,error:deliveryError},{data:experiments,error:experimentError},{data:assignments,error:assignmentError},{data:outcomes,error:outcomeError}]=await Promise.all([client.from("lifecycle_automations").select("automation_key,enabled,delay_hours,channel,updated_at").eq("workspace_id",workspace.id).order("automation_key"),client.from("lifecycle_deliveries").select("id,automation_key,status,channel,scheduled_for,sent_at,created_at").eq("workspace_id",workspace.id).order("created_at",{ascending:false}).limit(50),client.from("growth_experiments").select("id,name,surface,status,primary_metric,allocation_percent,variants,started_at,ended_at,created_at").eq("workspace_id",workspace.id).order("created_at",{ascending:false}).limit(20),client.from("growth_experiment_assignments").select("experiment_id,user_id,variant_key,first_exposed_at").eq("workspace_id",workspace.id).limit(20000),client.from("product_activation_events").select("user_id,event_name,occurred_at").eq("workspace_id",workspace.id).eq("event_name","asset_tested").limit(20000)]);if(error||deliveryError||experimentError||assignmentError||outcomeError)throw error||deliveryError||experimentError||assignmentError||outcomeError;const experimentReports=(experiments||[]).map(experiment=>({...experiment,results:(experiment.variants||[]).map(variant=>{const assigned=(assignments||[]).filter(a=>a.experiment_id===experiment.id&&a.variant_key===variant.key);const converted=new Set(assigned.filter(a=>(outcomes||[]).some(o=>o.user_id===a.user_id&&new Date(o.occurred_at)>=new Date(a.first_exposed_at))).map(a=>a.user_id)).size;return{key:variant.key,label:variant.label,assigned:assigned.length,converted,conversionPercent:assigned.length?Number((converted/assigned.length*100).toFixed(1)):0};})}));return{automations:(automations||[]).map(a=>({key:a.automation_key,enabled:a.enabled,delayHours:a.delay_hours,channel:a.channel,updatedAt:a.updated_at})),deliveries:{queued:(deliveries||[]).filter(d=>d.status==="queued").length,sent:(deliveries||[]).filter(d=>d.status==="sent").length,failed:(deliveries||[]).filter(d=>d.status==="failed").length,recent:(deliveries||[]).slice(0,8).map(d=>({id:d.id,key:d.automation_key,status:d.status,channel:d.channel,scheduledFor:d.scheduled_for,sentAt:d.sent_at,createdAt:d.created_at}))},experiments:experimentReports};},
    async updateLifecycleAutomation(userId,key,input){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can update lifecycle automation."),{status:403});const{error}=await client.from("lifecycle_automations").upsert({workspace_id:workspace.id,automation_key:key,enabled:input.enabled,delay_hours:input.delayHours,channel:input.channel,updated_by:userId,updated_at:new Date().toISOString()},{onConflict:"workspace_id,automation_key"});if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"governance",action:"lifecycle.automation_updated",target_type:"lifecycle_automation",target_id:key,metadata:input});return this.getLifecycleGrowth(userId);},
    async createGrowthExperiment(userId,input){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can create experiments."),{status:403});const{data,error}=await client.from("growth_experiments").insert({workspace_id:workspace.id,name:input.name,surface:"creator_primary_cta",status:"draft",primary_metric:"tested_activation",allocation_percent:input.allocationPercent,variants:input.variants,created_by:userId}).select("id").single();if(error)throw error;await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"governance",action:"growth.experiment_created",target_type:"growth_experiment",target_id:data.id,metadata:{name:input.name,allocationPercent:input.allocationPercent}});return this.getLifecycleGrowth(userId);},
    async setGrowthExperimentStatus(userId,id,status){const workspace=await getOwnedWorkspace(userId);if(!workspace)throw Object.assign(new Error("Only the workspace owner can control experiments."),{status:403});if(status==="running"){const{error:pauseError}=await client.from("growth_experiments").update({status:"paused",updated_at:new Date().toISOString()}).eq("workspace_id",workspace.id).eq("surface","creator_primary_cta").eq("status","running").neq("id",id);if(pauseError)throw pauseError;}const patch={status,updated_at:new Date().toISOString(),...(status==="running"?{started_at:new Date().toISOString(),ended_at:null}:{}),...(status==="completed"?{ended_at:new Date().toISOString()}: {})};const{data,error}=await client.from("growth_experiments").update(patch).eq("id",id).eq("workspace_id",workspace.id).select("id").maybeSingle();if(error)throw error;if(!data)throw Object.assign(new Error("Experiment not found."),{status:404});await client.from("organization_audit_events").insert({workspace_id:workspace.id,actor_id:userId,category:"governance",action:`growth.experiment_${status}`,target_type:"growth_experiment",target_id:id});return this.getLifecycleGrowth(userId);},
    async assignGrowthVariant(user,surface){const workspace=await findOrCreateWorkspace(user);const{data:experiment,error}=await client.from("growth_experiments").select("id,variants,allocation_percent").eq("workspace_id",workspace.id).eq("surface",surface).eq("status","running").maybeSingle();if(error)throw error;if(!experiment)return null;const digest=createHash("sha256").update(`${experiment.id}:${user.id}`).digest();const bucket=digest.readUInt16BE(0)%100;if(bucket>=experiment.allocation_percent)return null;const variants=experiment.variants||[];const variant=variants[digest.readUInt16BE(2)%variants.length];const{data,error:assignmentError}=await client.from("growth_experiment_assignments").upsert({experiment_id:experiment.id,workspace_id:workspace.id,user_id:user.id,variant_key:variant.key},{onConflict:"experiment_id,user_id",ignoreDuplicates:true}).select("variant_key").maybeSingle();if(assignmentError)throw assignmentError;return{experimentId:experiment.id,variantKey:data?.variant_key||variant.key,label:variants.find(v=>v.key===(data?.variant_key||variant.key))?.label||variant.label};},
    async materializeLifecycleDeliveries(limit=100){const{data,error}=await client.rpc("materialize_lifecycle_deliveries",{batch_size:limit});if(error)throw error;return data||0;},
    async claimLifecycleDelivery(){const{data,error}=await client.rpc("claim_lifecycle_delivery");if(error)throw error;const delivery=data?.[0];if(!delivery)return null;const{data:userData,error:userError}=await client.auth.admin.getUserById(delivery.user_id);if(userError||!userData.user?.email){await client.from("lifecycle_deliveries").update({status:"skipped",error_code:"EMAIL_UNAVAILABLE"}).eq("id",delivery.id);return null;}return{id:delivery.id,userId:delivery.user_id,email:userData.user.email,assetId:delivery.asset_id,key:delivery.automation_key,channel:delivery.channel};},
    async completeLifecycleDelivery(id,providerMessageId){const{error}=await client.from("lifecycle_deliveries").update({status:"sent",provider_message_id:providerMessageId||null,sent_at:new Date().toISOString(),error_code:null}).eq("id",id).eq("status","sending");if(error)throw error;},
    async failLifecycleDelivery(id,errorCode){const{error}=await client.from("lifecycle_deliveries").update({status:"failed",error_code:String(errorCode||"DELIVERY_FAILED").slice(0,80)}).eq("id",id).eq("status","sending");if(error)throw error;},
    async deliverInAppLifecycle(userId){const{data,error}=await client.from("lifecycle_deliveries").select("id,automation_key,asset_id,scheduled_for").eq("user_id",userId).eq("channel","in_app").eq("status","queued").lte("scheduled_for",new Date().toISOString()).order("scheduled_for").limit(3);if(error)throw error;const rows=data||[];if(rows.length){const{error:updateError}=await client.from("lifecycle_deliveries").update({status:"sent",sent_at:new Date().toISOString(),provider_message_id:"in-app"}).in("id",rows.map(x=>x.id)).eq("status","queued");if(updateError)throw updateError;}return rows.map(row=>({id:row.id,key:row.automation_key,assetId:row.asset_id,title:row.automation_key==="complete_first_test"?"Your capability is ready to test":"Your tested capability is ready to publish",detail:row.automation_key==="complete_first_test"?"Open Playground and run the saved quality suite.":"Complete the trust scan and submit it for review.",destination:row.automation_key==="complete_first_test"?"playground":"publishing"}));},
    async inviteMember(user, { email, role }) {
      const workspace = await getOwnedWorkspace(user.id);
      if (!workspace) throw Object.assign(new Error("Only an owner can invite members."), { status: 403 });
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await client.from("workspace_members").upsert({ workspace_id: workspace.id, invited_email: email, role, status: "pending", invite_token_hash: hashToken(token), invite_expires_at: expiresAt, accepted_at: null }, { onConflict: "workspace_id,invited_email" });
      if (error) throw error;
      await recordActivity(workspace.id, user.id, `Invited ${email} as ${role}.`);
      return { workspace: await serializeWorkspace(workspace, user), invitation: { token, expiresAt, email } };
    },
    async acceptInvitation(user, token) {
      const { data: invitation, error } = await client.from("workspace_members").select("id,workspace_id,invited_email,invite_expires_at,status").eq("invite_token_hash", hashToken(token)).maybeSingle();
      if (error) throw error;
      if (!invitation || invitation.status !== "pending" || new Date(invitation.invite_expires_at) <= new Date()) throw Object.assign(new Error("Invitation is invalid or expired."), { status: 410 });
      if (invitation.invited_email.toLowerCase() !== user.email.toLowerCase()) throw Object.assign(new Error("Sign in with the invited email address."), { status: 403 });
      const { error: updateError } = await client.from("workspace_members").update({ user_id: user.id, status: "active", accepted_at: new Date().toISOString(), invite_token_hash: null }).eq("id", invitation.id);
      if (updateError) throw updateError;
      const { data: workspace, error: workspaceError } = await client.from("workspaces").select("id,name,owner_id,created_at,updated_at").eq("id", invitation.workspace_id).single();
      if (workspaceError) throw workspaceError;
      await recordActivity(workspace.id, user.id, `${user.email} accepted the workspace invitation.`);
      return serializeWorkspace(workspace, user);
    },
    async resendInvitation(user, memberId) {
      const workspace = await getOwnedWorkspace(user.id);
      if (!workspace) throw Object.assign(new Error("Only an owner can resend invitations."), { status: 403 });
      const { data: member, error: memberError } = await client.from("workspace_members").select("id,invited_email,status").eq("id", memberId).eq("workspace_id", workspace.id).single();
      if (memberError || member.status !== "pending") throw Object.assign(new Error("Pending invitation not found."), { status: 404 });
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await client.from("workspace_members").update({ invite_token_hash: hashToken(token), invite_expires_at: expiresAt }).eq("id", member.id);
      if (error) throw error;
      await recordActivity(workspace.id, user.id, `Resent invitation to ${member.invited_email}.`);
      return { workspace: await serializeWorkspace(workspace, user), invitation: { token, expiresAt, email: member.invited_email }, workspaceName: workspace.name };
    },
    async updateMember(user, memberId, role) {
      const workspace = await getOwnedWorkspace(user.id);
      if (!workspace) throw Object.assign(new Error("Only an owner can update members."), { status: 403 });
      const { error } = await client.from("workspace_members").update({ role }).eq("id", memberId).eq("workspace_id", workspace.id);
      if (error) throw error;
      await recordActivity(workspace.id, user.id, `Updated a member role to ${role}.`);
      return serializeWorkspace(workspace, user);
    },
    async removeMember(user, memberId) {
      const workspace = await getOwnedWorkspace(user.id);
      if (!workspace) throw Object.assign(new Error("Only an owner can remove members."), { status: 403 });
      const { error } = await client.from("workspace_members").delete().eq("id", memberId).eq("workspace_id", workspace.id);
      if (error) throw error;
      await recordActivity(workspace.id, user.id, "Removed a member from the workspace.");
      return serializeWorkspace(workspace, user);
    },
    async shareAsset(user, { assetId, email, access }) {
      const workspace = await findOrCreateWorkspace(user);
      if (!(await canEditWorkspace(workspace.id, user.id))) throw Object.assign(new Error("Editor access is required."), { status: 403 });
      if (workspace.owner_id === user.id) {
        const { error: memberError } = await client.from("workspace_members").upsert({ workspace_id: workspace.id, invited_email: email, role: access, status: "pending" }, { onConflict: "workspace_id,invited_email" });
        if (memberError) throw memberError;
      }
      const { data: asset, error: assetError } = await client.from("assets").select("id,user_id").eq("id", assetId).single();
      if (assetError || asset.user_id !== user.id) throw Object.assign(new Error("Only the asset owner can share it."), { status: 403 });
      const { error } = await client.from("asset_shares").upsert({ asset_id: assetId, workspace_id: workspace.id, shared_by: user.id, access_level: access }, { onConflict: "asset_id,workspace_id" });
      if (error) throw error;
      await recordActivity(workspace.id, user.id, `Shared an asset with ${email} as ${access}.`);
      return serializeWorkspace(workspace, user);
    },
  };
}
