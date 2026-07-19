import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAIProvider } from "./openai-provider.mjs";
import { createSupabaseRepository } from "./supabase-repository.mjs";
import { createMongoRepository } from "./mongo-repository.mjs";
import { createEmailProvider } from "./email-provider.mjs";
import { createStripeProvider } from "./stripe-provider.mjs";
import { createAgentPlanner } from "./agent-planner.mjs";
import { encryptProviderKey, infrastructureVaultReady } from "./infrastructure-vault.mjs";
import { adminAccessReady, createAdminSession, createDeviceSession, sessionTokensReady, verifyAdminAccessKey, verifyAdminSession } from "./session-token.mjs";

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 8787);
const aiProvider = createOpenAIProvider();
const repository = createMongoRepository() || createSupabaseRepository();
const emailProvider = createEmailProvider();
const stripeProvider = createStripeProvider();
const agentPlanner = createAgentPlanner();

async function authenticate(request) {
  if (!repository) return null;
  const authorization = request.header("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return repository.verifyUser(accessToken);
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((request,response,next)=>{const requestId=randomUUID();request.requestId=requestId;response.setHeader("x-request-id",requestId);response.setHeader("x-content-type-options","nosniff");response.setHeader("x-frame-options","DENY");response.setHeader("referrer-policy","no-referrer");response.setHeader("permissions-policy","camera=(), microphone=(), geolocation=()");const apiRequest=request.path.startsWith("/api/")||request.path.startsWith("/scim/");response.setHeader("content-security-policy",apiRequest?"default-src 'none'; frame-ancestors 'none'; base-uri 'none'":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");response.on("finish",()=>{if(!repository||!request.path.startsWith("/api/"))return;const raw=`${request.baseUrl||""}${request.route?.path||request.path}`;const routeName=raw.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,":id").replace(/\/\d+(?=\/|$)/g,"/:id").slice(0,120);repository.recordServiceRequestSample({routeName,method:request.method,statusCode:response.statusCode,durationMs:Math.min(300000,Math.max(0,Math.round(performance.now()-request.startedAt))),requestId}).catch(error=>console.error("sla_sample_failed",{message:error?.message}));});request.startedAt=performance.now();next();});
app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "256kb" }), async (request, response) => {
  if (!stripeProvider) return response.status(503).json({ error: "Payments are not configured." });
  if (!repository) return response.status(503).json({ error: "Payment persistence is not configured." });
  try {
    const event = stripeProvider.verifyWebhook(request.body.toString("utf8"), request.header("stripe-signature"));
    if (!event) return response.status(400).json({ error: "Invalid webhook signature." });
    const processed = await repository.recordPaymentEvent(event);
    return response.json({ received: true, processed });
  } catch (error) {
    console.error("payment_webhook_failed", { message: error?.message });
    return response.status(error instanceof SyntaxError ? 400 : 503).json({ error: error instanceof SyntaxError ? "Invalid webhook payload." : "Webhook persistence failed." });
  }
});
app.use(express.json({ limit: "32kb" }));

const readAuthSession = async (request, response) => {
  if (!sessionTokensReady() || repository?.name !== "mongodb") return response.status(503).json({ error: "MongoDB authentication is not configured." });
  const authorization = request.header("authorization") || "";
  const currentToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const currentUser = await repository.verifyUser(currentToken);
  if (!currentUser) return response.status(401).json({ error: "This session is unavailable, expired, or suspended.", code: "SESSION_UNAVAILABLE" });
  return response.json({ session: { access_token: currentToken, user: currentUser } });
};
app.get("/api/auth/session", readAuthSession);
app.post("/api/auth/session", readAuthSession);

const authAttempts = new Map();
const authAttempt = (request) => { const key = request.ip || "unknown", current = authAttempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 }; if (current.resetAt <= Date.now()) { current.count = 0; current.resetAt = Date.now() + 15 * 60 * 1000; } return { key, current }; };
app.post("/api/auth/register", async (request, response) => {
  if (!sessionTokensReady() || repository?.name !== "mongodb") return response.status(503).json({ error: "MongoDB authentication is not configured." });
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "", email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "", password = typeof request.body?.password === "string" ? request.body.password : "";
  if (name.length < 2 || name.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 10 || password.length > 128) return response.status(400).json({ error: "Enter a valid name, email, and password of at least 10 characters." });
  const { key, current } = authAttempt(request); if (current.count >= 8) return response.status(429).json({ error: "Too many account attempts. Try again later." });
  try { const user = await repository.registerUser({ name, email, password }), session = createDeviceSession(user); authAttempts.delete(key); return response.status(201).json({ session }); }
  catch (error) { current.count += 1; authAttempts.set(key, current); return response.status(error?.status || 502).json({ error: error?.status === 409 ? error.message : "Account could not be created." }); }
});
app.post("/api/auth/login", async (request, response) => {
  if (!sessionTokensReady() || repository?.name !== "mongodb") return response.status(503).json({ error: "MongoDB authentication is not configured." });
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "", password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!email || !password || email.length > 254 || password.length > 128) return response.status(400).json({ error: "Email and password are required." });
  const { key, current } = authAttempt(request); if (current.count >= 8) return response.status(429).json({ error: "Too many sign-in attempts. Try again later." });
  try { const user = await repository.authenticateUser(email, password); if (!user) { current.count += 1; authAttempts.set(key, current); return response.status(401).json({ error: "Email or password is incorrect." }); } authAttempts.delete(key); return response.json({ session: createDeviceSession(user) }); }
  catch { current.count += 1; authAttempts.set(key, current); return response.status(502).json({ error: "Sign-in service is temporarily unavailable." }); }
});

const adminAttempts = new Map();
app.post("/api/admin/session", async (request, response) => {
  if (repository?.name !== "mongodb" || !adminAccessReady()) return response.status(503).json({ error: "Admin access is not configured." });
  const key = request.ip || "unknown", current = adminAttempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
  if (current.resetAt <= Date.now()) { current.count = 0; current.resetAt = Date.now() + 15 * 60 * 1000; }
  if (current.count >= 8) return response.status(429).json({ error: "Too many admin sign-in attempts. Try again later." });
  if (!verifyAdminAccessKey(request.body?.accessKey)) { current.count += 1; adminAttempts.set(key, current); return response.status(401).json({ error: "Invalid admin access key." }); }
  adminAttempts.delete(key);
  return response.status(201).json({ session: createAdminSession() });
});

const requireAdmin = async (request, response) => {
  const authorization = request.header("authorization") || "", token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "", admin = verifyAdminSession(token);
  if (!admin) response.status(401).json({ error: "A valid administrator session is required.", code: "ADMIN_UNAUTHORIZED" });
  return admin;
};

app.get("/api/admin/overview", async (request, response) => {
  const admin = await requireAdmin(request, response); if (!admin) return;
  const query = typeof request.query.query === "string" ? request.query.query.trim().slice(0, 80) : "", status = ["all", "active", "suspended"].includes(request.query.status) ? request.query.status : "all", offset = Math.max(0, Math.min(10000, Number.parseInt(request.query.offset, 10) || 0));
  try { return response.json({ overview: await repository.getAdminOverview({ query, status, limit: 50, offset }) }); }
  catch { return response.status(502).json({ error: "Admin user overview could not be loaded." }); }
});

app.patch("/api/admin/users/:id", async (request, response) => {
  const admin = await requireAdmin(request, response); if (!admin) return;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(400).json({ error: "A valid user id is required." });
  const status = request.body?.status, label = request.body?.label;
  if ((status !== undefined && !["active", "suspended"].includes(status)) || (label !== undefined && (typeof label !== "string" || label.trim().length < 2 || label.length > 80))) return response.status(400).json({ error: "A valid user status or label is required." });
  try { return response.json({ user: await repository.updateAdminUser(request.params.id, { status, label }, admin.id) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 404 ? error.message : "User control could not be updated." }); }
});

app.post("/api/admin/users/:id/backups", async (request, response) => {
  const admin = await requireAdmin(request, response); if (!admin) return;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(400).json({ error: "A valid user id is required." });
  try { return response.status(201).json({ backup: await repository.createAdminUserBackup(request.params.id, admin.id) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.message || "User backup could not be created." }); }
});

app.get("/api/admin/users/:id/export", async (request, response) => {
  const admin = await requireAdmin(request, response); if (!admin) return;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(400).json({ error: "A valid user id is required." });
  try { const snapshot = await repository.exportAdminUserData(request.params.id, admin.id); response.setHeader("content-disposition", `attachment; filename="intentos-user-${request.params.id.slice(0,8)}-${new Date().toISOString().slice(0,10)}.json"`); return response.json(snapshot); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 404 ? error.message : "User data export could not be created." }); }
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    ai: aiProvider ? { enabled: true, provider: aiProvider.name, model: aiProvider.model } : { enabled: false, provider: "local-fallback" },
    database: repository ? { enabled: true, provider: repository.name } : { enabled: false, provider: "browser-storage" },
    email: emailProvider ? { enabled: true, provider: emailProvider.name } : { enabled: false, provider: "manual-link" },
    payments: stripeProvider ? { enabled: true, provider: stripeProvider.name, apiVersion: stripeProvider.apiVersion } : { enabled: false, provider: "test-mode" },
    admin: { enabled: repository?.name === "mongodb" && adminAccessReady() },
  });
});
app.get("/api/readiness",(_request,response)=>{const checks={database:Boolean(repository),aiProvider:Boolean(aiProvider),emailProvider:Boolean(emailProvider),payments:Boolean(stripeProvider),encryptionVault:infrastructureVaultReady};const critical=checks.database&&checks.encryptionVault;return response.status(critical?200:503).json({status:critical?"ready":"attention",checks,timestamp:new Date().toISOString()});});

app.post("/api/payments/checkout", async (request, response) => {
  if (!stripeProvider) return response.status(503).json({ error: "Live payments are not configured.", code: "PAYMENTS_UNAVAILABLE" });
  if (!repository) return response.status(503).json({ error: "Payment persistence is not configured.", code: "ENTITLEMENTS_UNAVAILABLE" });
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ error: "Sign in before purchasing a paid capability.", code: "UNAUTHORIZED" });
  const assetId = typeof request.body?.assetId === "string" ? request.body.assetId : "";
  if (!stripeProvider.product(assetId)) return response.status(400).json({ error: "A valid paid asset is required." });
  const appUrl = process.env.APP_URL || "http://localhost:4173";
  try {
    const session = await stripeProvider.createCheckout({ assetId, customerEmail: user.email, userId: user.id, successUrl: `${appUrl}?checkout=success`, cancelUrl: `${appUrl}?checkout=cancelled` });
    return response.status(201).json({ session: { id: session.id, url: session.url } });
  } catch (error) {
    console.error("stripe_checkout_failed", { status: error?.status });
    return response.status(502).json({ error: "Checkout could not be started.", code: "CHECKOUT_FAILED" });
  }
});

app.get("/api/payments/entitlements", async (request, response) => {
  if (!repository) return response.status(503).json({ error: "Payment persistence is not configured.", code: "DATABASE_UNAVAILABLE" });
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ error: "A valid session is required.", code: "UNAUTHORIZED" });
  try { return response.json({ purchases: await repository.listPurchases(user.id) }); }
  catch { return response.status(502).json({ error: "Could not load payment entitlements.", code: "DATABASE_ERROR" }); }
});

const requireExecutionUser = async (request, response) => {
  if (!repository) { response.status(503).json({ error: "Execution persistence is not configured.", code: "DATABASE_UNAVAILABLE" }); return null; }
  const user = await authenticate(request);
  if (!user) response.status(401).json({ error: "A valid session is required.", code: "UNAUTHORIZED" });
  return user;
};

app.get("/api/agent-runs", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  try { return response.json({ runs: await repository.listAgentRuns(user.id) }); }
  catch { return response.status(502).json({ error: "Could not load agent runs.", code: "DATABASE_ERROR" }); }
});

app.post("/api/agent-runs", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  const agentId = typeof request.body?.agentId === "string" ? request.body.agentId.trim() : "";
  const agentTitle = typeof request.body?.agentTitle === "string" ? request.body.agentTitle.trim() : "";
  const mission = typeof request.body?.mission === "string" ? request.body.mission.trim() : "";
  const permissions = request.body?.permissions;
  const idempotencyKey = request.header("idempotency-key") || "";
  if (!agentId || agentId.length > 100 || agentTitle.length < 3 || agentTitle.length > 100 || mission.length < 12 || mission.length > 500 || !permissions || [permissions.web, permissions.workspace, permissions.external].some((value) => typeof value !== "boolean") || idempotencyKey.length < 8 || idempotencyKey.length > 128) return response.status(400).json({ error: "A valid agent, mission, permissions, and idempotency key are required." });
  if (!await repository.isWorkspaceFeatureEnabled(user.id,"agent_execution").catch(()=>false)) return response.status(403).json({error:"Agent execution is disabled by workspace feature policy.",code:"FEATURE_DISABLED"});
  if (permissions.external) {
    try { if (!await repository.authorizeExternalAgentActions(user.id)) return response.status(403).json({ error: "External agent actions are blocked by workspace governance policy.", code: "POLICY_BLOCKED" }); }
    catch { return response.status(502).json({ error: "Workspace policy could not be evaluated." }); }
  }
  try {
    const created = await repository.createAgentRun(user.id, { agentId, agentTitle, mission, permissions, idempotencyKey });
    if (!created.plan) {
      const plan = await agentPlanner.plan({ mission: created.mission, agent_title: created.agentTitle, permissions: created.permissions });
      await repository.recordAgentPlan(created.id, plan);
    }
    return response.status(201).json({ run: await repository.getAgentRun(user.id, created.id) });
  }
  catch { return response.status(502).json({ error: "Agent run could not be created.", code: "DATABASE_ERROR" }); }
});

app.post("/api/agent-runs/:id/decision", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  const decision = request.body?.decision;
  if (!["approve", "reject"].includes(decision) || !/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(400).json({ error: "A valid run and decision are required." });
  try { return response.json({ run: await repository.decideAgentRun(user.id, request.params.id, decision === "approve") }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 409 ? error.message : "Run decision could not be recorded." }); }
});

app.post("/api/agent-runs/:id/cancel", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(400).json({ error: "A valid run is required." });
  try { return response.json({ run: await repository.cancelAgentRun(user.id, request.params.id) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 409 ? error.message : "Run could not be cancelled." }); }
});

app.post("/api/agent-runs/:id/retry", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(400).json({ error: "A valid run is required." });
  try { return response.json({ run: await repository.retryAgentRun(user.id, request.params.id) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 409 ? error.message : "Run could not be retried." }); }
});

app.post("/api/agent-action-approvals/:id/decision", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  const decision = request.body?.decision;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id) || !["approve","reject"].includes(decision)) return response.status(400).json({ error: "A valid action approval decision is required." });
  try { return response.json({ run: await repository.decideAgentAction(user.id, request.params.id, decision === "approve") }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 409 ? error.message : "Action decision could not be recorded." }); }
});

app.get("/api/agent-memories", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  try { return response.json({ memories: await repository.listAgentMemories(user.id) }); }
  catch { return response.status(502).json({ error: "Could not load agent memories." }); }
});

app.get("/api/agent-operations", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  try { return response.json({ operations: await repository.getAgentOperations(user.id) }); }
  catch { return response.status(502).json({ error: "Could not load execution operations." }); }
});

app.get("/api/governance", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  try { return response.json({ governance: await repository.getWorkspaceGovernance(user.id) }); }
  catch { return response.status(502).json({ error: "Could not load workspace governance." }); }
});

app.patch("/api/governance", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  const { auditRetentionDays, requireProductionApproval, allowExternalAgentActions } = request.body || {};
  if (!Number.isInteger(auditRetentionDays) || auditRetentionDays < 30 || auditRetentionDays > 2555 || typeof requireProductionApproval !== "boolean" || typeof allowExternalAgentActions !== "boolean") return response.status(400).json({ error: "Valid governance controls are required." });
  try { return response.json({ governance: await repository.updateWorkspaceGovernance(user.id, { auditRetentionDays, requireProductionApproval, allowExternalAgentActions }) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 403 ? error.message : "Governance could not be updated." }); }
});

app.get("/api/governance/audit-export", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  const format = request.query.format === "csv" ? "csv" : "json";
  try {
    const result = await repository.exportWorkspaceAudit(user.id);
    response.setHeader("content-disposition", `attachment; filename="intentos-audit-${new Date().toISOString().slice(0,10)}.${format}"`);
    if (format === "json") return response.type("application/json").send(JSON.stringify({ workspace: { id: result.workspace.id, name: result.workspace.name }, exportedAt: new Date().toISOString(), events: result.events }, null, 2));
    const cell = (value) => `"${String(value ?? "").replaceAll('"','""')}"`;
    const rows = [["id","created_at","actor_id","category","action","target_type","target_id","metadata"], ...result.events.map((event) => [event.id,event.created_at,event.actor_id,event.category,event.action,event.target_type,event.target_id,JSON.stringify(event.metadata)])];
    return response.type("text/csv").send(rows.map((row) => row.map(cell).join(",")).join("\n"));
  } catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 403 ? error.message : "Audit export could not be created." }); }
});

app.delete("/api/agent-memories/:id", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(400).json({ error: "A valid memory is required." });
  try { await repository.deleteAgentMemory(user.id, request.params.id); return response.status(204).end(); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 404 ? error.message : "Memory could not be deleted." }); }
});

app.get("/api/agent-schedules", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  try { return response.json({ schedules: await repository.listAgentSchedules(user.id) }); }
  catch { return response.status(502).json({ error: "Could not load schedules." }); }
});

app.post("/api/agent-schedules", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  const { agentId, agentTitle, mission, cadence, timezone, nextRunAt, permissions } = request.body || {};
  const parsedNextRun = new Date(nextRunAt);
  if (typeof agentId !== "string" || !agentId || agentId.length > 100 || typeof agentTitle !== "string" || agentTitle.length < 3 || agentTitle.length > 100 || typeof mission !== "string" || mission.trim().length < 12 || mission.trim().length > 500 || !["daily","weekly"].includes(cadence) || typeof timezone !== "string" || timezone.length < 1 || timezone.length > 64 || Number.isNaN(parsedNextRun.getTime()) || parsedNextRun <= new Date() || parsedNextRun > new Date(Date.now() + 366 * 24 * 60 * 60 * 1000) || !permissions || typeof permissions.web !== "boolean" || typeof permissions.workspace !== "boolean" || permissions.external !== false) return response.status(400).json({ error: "A valid read-only schedule is required." });
  try { return response.status(201).json({ schedule: await repository.createAgentSchedule(user.id, { agentId, agentTitle, mission: mission.trim(), cadence, timezone, nextRunAt: parsedNextRun.toISOString(), permissions }) }); }
  catch { return response.status(502).json({ error: "Schedule could not be created." }); }
});

app.patch("/api/agent-schedules/:id", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id) || typeof request.body?.active !== "boolean") return response.status(400).json({ error: "A valid schedule state is required." });
  try { return response.json({ schedule: await repository.setAgentScheduleActive(user.id, request.params.id, request.body.active) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 404 ? error.message : "Schedule could not be updated." }); }
});

app.delete("/api/agent-schedules/:id", async (request, response) => {
  const user = await requireExecutionUser(request, response); if (!user) return;
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(400).json({ error: "A valid schedule is required." });
  try { await repository.deleteAgentSchedule(user.id, request.params.id); return response.status(204).end(); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 404 ? error.message : "Schedule could not be deleted." }); }
});

app.post("/api/generate", async (request, response) => {
  const intent = typeof request.body?.intent === "string" ? request.body.intent.trim() : "";
  const mode = ["auto", "prompt", "skill", "agent"].includes(request.body?.mode) ? request.body.mode : "auto";

  if (intent.length < 5 || intent.length > 500) {
    return response.status(400).json({ error: "Intent must be between 5 and 500 characters." });
  }
  if (!aiProvider) return response.status(503).json({ error: "AI provider is not configured.", code: "PROVIDER_UNAVAILABLE" });

  try {
    const content = await aiProvider.generate({ intent, mode });
    const asset = {
      id: randomUUID(),
      version: 1,
      createdAt: new Date().toISOString(),
      sourceIntent: intent,
      provider: `${aiProvider.name}:${aiProvider.model}`,
      ...content,
    };
    const user = await authenticate(request);
    if (repository && user) await repository.save(asset, user.id);
    return response.status(201).json({ asset });
  } catch (error) {
    console.error("generation_failed", { name: error?.name, status: error?.status });
    return response.status(502).json({ error: "Generation failed. Please retry.", code: "GENERATION_FAILED" });
  }
});

app.post("/api/evaluate", async (request, response) => {
  const asset = request.body?.asset;
  const input = typeof request.body?.input === "string" ? request.body.input.trim() : "";
  if (!asset?.id || !Array.isArray(asset.sections) || input.length < 3 || input.length > 2000) {
    return response.status(400).json({ error: "A valid asset and test input are required." });
  }
  if (!aiProvider) return response.status(503).json({ error: "AI provider is not configured.", code: "PROVIDER_UNAVAILABLE" });
  try {
    const result = await aiProvider.evaluate({ asset, input });
    return response.json({ result: { ...result, provider: aiProvider.name, model: aiProvider.model, executedAt: new Date().toISOString() } });
  } catch (error) {
    console.error("evaluation_failed", { name: error?.name, status: error?.status });
    return response.status(502).json({ error: "Provider evaluation failed.", code: "EVALUATION_FAILED" });
  }
});

app.get("/api/assets", async (request, response) => {
  if (!repository) return response.status(503).json({ error: "Cloud persistence is not configured.", code: "DATABASE_UNAVAILABLE" });
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ error: "A valid session is required.", code: "UNAUTHORIZED" });
  try {
    return response.json({ assets: await repository.list(user.id) });
  } catch {
    return response.status(502).json({ error: "Could not load cloud assets.", code: "DATABASE_ERROR" });
  }
});

app.post("/api/assets", async (request, response) => {
  if (!repository) return response.status(503).json({ error: "Cloud persistence is not configured.", code: "DATABASE_UNAVAILABLE" });
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ error: "A valid session is required.", code: "UNAUTHORIZED" });
  const asset = request.body?.asset;
  const valid = asset && /^[0-9a-f-]{36}$/i.test(asset.id || "") && ["Prompt", "Skill", "Agent"].includes(asset.type) && typeof asset.title === "string" && asset.title.length >= 3 && asset.title.length <= 100 && typeof asset.summary === "string" && asset.summary.length <= 240 && Array.isArray(asset.sections) && asset.sections.length >= 3 && asset.sections.length <= 8 && JSON.stringify(asset).length <= 16000;
  if (!valid) return response.status(400).json({ error: "A valid Prompt, Skill, or Agent asset is required." });
  try { return response.status(201).json({ asset: await repository.save(asset, user.id) }); }
  catch { return response.status(502).json({ error: "Could not save the cloud asset.", code: "DATABASE_ERROR" }); }
});

app.delete("/api/assets/:id", async (request, response) => {
  if (!repository) return response.status(503).json({ error: "Cloud persistence is not configured.", code: "DATABASE_UNAVAILABLE" });
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ error: "A valid session is required.", code: "UNAUTHORIZED" });
  try {
    await repository.remove(request.params.id, user.id);
    return response.status(204).end();
  } catch {
    return response.status(502).json({ error: "Could not delete the cloud asset.", code: "DATABASE_ERROR" });
  }
});

const requireWorkspaceUser = async (request, response) => {
  if (!repository) {
    response.status(503).json({ error: "Cloud collaboration is not configured.", code: "DATABASE_UNAVAILABLE" });
    return null;
  }
  const user = await authenticate(request);
  if (!user) response.status(401).json({ error: "A valid session is required.", code: "UNAUTHORIZED" });
  return user;
};

const validRole = (role, includeOwner = false) => [...(includeOwner ? ["owner"] : []), "editor", "viewer"].includes(role);

app.get("/api/identity", async (request,response)=>{ const user=await requireWorkspaceUser(request,response); if(!user)return; try{return response.json({identity:await repository.getWorkspaceIdentity(user.id)});}catch{return response.status(502).json({error:"Could not load enterprise identity."});} });
app.patch("/api/identity", async (request,response)=>{ const user=await requireWorkspaceUser(request,response); if(!user)return; const {ssoEnabled,verifiedDomain,samlMetadataUrl,scimEnabled}=request.body||{}; if(typeof ssoEnabled!=="boolean"||typeof scimEnabled!=="boolean"||typeof verifiedDomain!=="string"||verifiedDomain.length>253||(verifiedDomain&&!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(verifiedDomain))||typeof samlMetadataUrl!=="string"||samlMetadataUrl.length>2048||(samlMetadataUrl&&!/^https:\/\//i.test(samlMetadataUrl))||(ssoEnabled&&(!verifiedDomain||!samlMetadataUrl))) return response.status(400).json({error:"Valid identity configuration is required; enabled SSO needs a domain and HTTPS metadata URL."}); try{return response.json({identity:await repository.updateWorkspaceIdentity(user.id,{ssoEnabled,verifiedDomain:verifiedDomain.toLowerCase(),samlMetadataUrl,scimEnabled})});}catch(error){return response.status(error?.status||502).json({error:error?.status===403?error.message:"Identity configuration could not be updated."});} });
app.post("/api/identity/scim-token", async (request,response)=>{ const user=await requireWorkspaceUser(request,response); if(!user)return; try{return response.status(201).json(await repository.rotateScimToken(user.id));}catch(error){return response.status(error?.status||502).json({error:error?.status===403?error.message:"SCIM token could not be rotated."});} });

const requireScimWorkspace=async(request,response)=>{ const authorization=request.header("authorization")||""; const token=authorization.startsWith("Bearer ")?authorization.slice(7):""; const workspaceId=repository?await repository.authenticateScimToken(token):null; if(!workspaceId) response.status(401).type("application/scim+json").json({schemas:["urn:ietf:params:scim:api:messages:2.0:Error"],status:"401",detail:"Invalid SCIM bearer token."}); return workspaceId; };
const scimUserInput=(body)=>{ const email=typeof body?.userName==="string"?body.userName.trim().toLowerCase():""; const role=body?.roles?.[0]?.value||body?.role||"viewer"; return {externalId:String(body?.externalId||"").trim(),email,displayName:String(body?.displayName||body?.name?.formatted||"").trim().slice(0,120),role,active:body?.active!==false}; };
const scimResource=(user)=>({schemas:["urn:ietf:params:scim:schemas:core:2.0:User"],id:user.id,externalId:user.externalId,userName:user.userName,displayName:user.displayName,active:user.active,roles:[{value:user.role}],meta:{resourceType:"User",lastModified:user.syncedAt}});
app.get("/scim/v2/Users",async(request,response)=>{const workspaceId=await requireScimWorkspace(request,response);if(!workspaceId)return;try{const users=await repository.listScimUsers(workspaceId);return response.type("application/scim+json").json({schemas:["urn:ietf:params:scim:api:messages:2.0:ListResponse"],totalResults:users.length,startIndex:1,itemsPerPage:users.length,Resources:users.map(scimResource)});}catch{return response.status(502).json({detail:"Directory query failed."});}});
app.post("/scim/v2/Users",async(request,response)=>{const workspaceId=await requireScimWorkspace(request,response);if(!workspaceId)return;const input=scimUserInput(request.body);if(!input.externalId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)||!validRole(input.role))return response.status(400).type("application/scim+json").json({detail:"externalId, userName and valid role are required."});try{return response.status(201).type("application/scim+json").json(scimResource(await repository.provisionScimUser(workspaceId,input)));}catch{return response.status(409).json({detail:"SCIM user could not be provisioned."});}});
app.put("/scim/v2/Users/:id",async(request,response)=>{const workspaceId=await requireScimWorkspace(request,response);if(!workspaceId)return;if(!/^[0-9a-f-]{36}$/i.test(request.params.id))return response.status(400).json({detail:"Invalid user id."});const input=scimUserInput(request.body);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)||!validRole(input.role))return response.status(400).json({detail:"Valid userName and role are required."});try{return response.type("application/scim+json").json(scimResource(await repository.updateScimUser(workspaceId,request.params.id,input)));}catch(error){return response.status(error?.status||502).json({detail:error?.status===404?error.message:"SCIM user update failed."});}});
app.delete("/scim/v2/Users/:id",async(request,response)=>{const workspaceId=await requireScimWorkspace(request,response);if(!workspaceId)return;if(!/^[0-9a-f-]{36}$/i.test(request.params.id))return response.status(400).json({detail:"Invalid user id."});try{await repository.updateScimUser(workspaceId,request.params.id,{active:false});return response.status(204).end();}catch(error){return response.status(error?.status||502).json({detail:error?.status===404?error.message:"SCIM deprovision failed."});}});

app.get("/api/releases",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({releases:await repository.listAssetReleases(user.id)});}catch{return response.status(502).json({error:"Could not load release history."});}});
app.post("/api/releases",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const assetId=request.body?.assetId;if(!/^[0-9a-f-]{36}$/i.test(assetId||""))return response.status(400).json({error:"A valid asset is required."});try{const releaseId=await repository.requestAssetPromotion(user.id,assetId);return response.status(201).json({releaseId,releases:await repository.listAssetReleases(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Promotion request failed."});}});
app.post("/api/releases/:id/decision",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const decision=request.body?.decision;if(!/^[0-9a-f-]{36}$/i.test(request.params.id)||!["approve","reject"].includes(decision))return response.status(400).json({error:"A valid release decision is required."});try{await repository.decideAssetPromotion(user.id,request.params.id,decision==="approve");return response.json({releases:await repository.listAssetReleases(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status===409?error.message:"Release decision failed."});}});
app.post("/api/releases/:id/rollback",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;if(!/^[0-9a-f-]{36}$/i.test(request.params.id))return response.status(400).json({error:"A valid release is required."});try{await repository.rollbackAssetRelease(user.id,request.params.id);return response.json({releases:await repository.listAssetReleases(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status===409?error.message:"Rollback failed."});}});
app.get("/api/infrastructure-controls",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({controls:await repository.getInfrastructureControls(user.id),vaultReady:infrastructureVaultReady});}catch{return response.status(502).json({error:"Could not load infrastructure controls."});}});
app.patch("/api/infrastructure-controls",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const{region,provider,apiKey}=request.body||{};if(!["in","us","eu","apac"].includes(region)||!["","openai","azure_openai","anthropic"].includes(provider)||typeof apiKey!=="string"||apiKey.length>500)return response.status(400).json({error:"Valid infrastructure controls are required."});try{const encrypted=apiKey?encryptProviderKey(apiKey):null;return response.json({controls:await repository.saveInfrastructureControls(user.id,{region,provider},encrypted),vaultReady:infrastructureVaultReady});}catch(error){return response.status(error?.status||502).json({error:error?.message||"Infrastructure controls could not be saved."});}});
app.delete("/api/infrastructure-controls/key",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({controls:await repository.revokeProviderKey(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Provider key could not be revoked."});}});
app.post("/api/recovery-drills",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const{rpoTargetMinutes,rtoTargetMinutes}=request.body||{};if(!Number.isInteger(rpoTargetMinutes)||rpoTargetMinutes<5||rpoTargetMinutes>1440||!Number.isInteger(rtoTargetMinutes)||rtoTargetMinutes<5||rtoTargetMinutes>2880)return response.status(400).json({error:"Valid RPO and RTO targets are required."});try{return response.status(201).json({controls:await repository.runRecoveryReadinessDrill(user.id,{rpoTargetMinutes,rtoTargetMinutes})});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Recovery drill failed."});}});

app.get("/api/enterprise-usage",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({usage:await repository.getEnterpriseUsage(user.id)});}catch{return response.status(502).json({error:"Could not load enterprise usage."});}});
app.patch("/api/enterprise-usage/flags/:key",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;if(!["agent_execution","production_promotion","marketplace_publish"].includes(request.params.key)||typeof request.body?.enabled!=="boolean")return response.status(400).json({error:"A valid feature flag is required."});try{return response.json({usage:await repository.updateWorkspaceFeatureFlag(user.id,request.params.key,request.body.enabled)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Feature flag could not be updated."});}});
app.get("/api/enterprise-usage/export",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{const usage=await repository.getEnterpriseUsage(user.id);response.setHeader("content-disposition",`attachment; filename="intentos-usage-${new Date().toISOString().slice(0,10)}.json"`);return response.json(usage);}catch{return response.status(502).json({error:"Usage export failed."});}});
app.get("/api/sla",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({sla:await repository.getSlaReport(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"SLA report could not be loaded."});}});
app.post("/api/activation/events",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const{eventName,sessionId,assetId,idempotencyKey,properties}=request.body||{};const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;const allowedEvents=["intent_submitted","asset_generated","asset_saved","asset_tested","asset_published"];const safeProperties=properties&&typeof properties==="object"&&!Array.isArray(properties)?properties:{};const propertyKeys=Object.keys(safeProperties);if(!allowedEvents.includes(eventName)||!uuid.test(sessionId)||!uuid.test(idempotencyKey)||(assetId!==null&&assetId!==undefined&&!uuid.test(assetId))||propertyKeys.some(key=>!["assetType","mode","source"].includes(key))||JSON.stringify(safeProperties).length>500)return response.status(400).json({error:"A valid privacy-safe activation event is required."});try{await repository.recordActivationEvent(user,{eventName,sessionId,assetId,idempotencyKey,properties:safeProperties});return response.status(202).json({accepted:true});}catch{return response.status(502).json({error:"Activation event could not be recorded."});}});
app.get("/api/activation/report",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({report:await repository.getActivationReport(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Activation report could not be loaded."});}});
app.get("/api/launch",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({launch:await repository.getLaunchCenter(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Launch center could not be loaded."});}});
app.patch("/api/launch/control",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const{rolloutMode,launchPaused,betaCapacity,activationTargetPercent}=request.body||{};if(!["internal","beta","public"].includes(rolloutMode)||typeof launchPaused!=="boolean"||!Number.isInteger(betaCapacity)||betaCapacity<1||betaCapacity>10000||typeof activationTargetPercent!=="number"||activationTargetPercent<1||activationTargetPercent>100)return response.status(400).json({error:"Valid launch controls are required."});try{return response.json({launch:await repository.updateLaunchControl(user.id,{rolloutMode,launchPaused,betaCapacity,activationTargetPercent})});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Launch controls could not be saved."});}});
app.post("/api/launch/access",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const cohortName=typeof request.body?.cohortName==="string"?request.body.cohortName.trim():"";if(cohortName.length<2||cohortName.length>80)return response.status(400).json({error:"A cohort name is required."});try{const access=await repository.createLaunchAccess(user.id,cohortName);const appUrl=process.env.APP_URL||"http://localhost:4173";return response.status(201).json({...access,url:`${appUrl}?launch_access=${encodeURIComponent(access.token)}`});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Beta access could not be created."});}});
app.delete("/api/launch/access/:id",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;if(!/^[0-9a-f-]{36}$/i.test(request.params.id))return response.status(400).json({error:"A valid access link is required."});try{await repository.revokeLaunchAccess(user.id,request.params.id);return response.status(204).end();}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Beta access could not be revoked."});}});
app.post("/api/launch/access/redeem",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const token=typeof request.body?.token==="string"?request.body.token.trim():"";if(token.length<32||token.length>100)return response.status(400).json({error:"A valid beta access token is required."});try{return response.json({workspace:await repository.redeemLaunchAccess(user,token)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Beta access could not be redeemed."});}});
app.get("/api/growth-operations",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({operations:await repository.getLifecycleGrowth(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Growth operations could not be loaded."});}});
app.patch("/api/growth-operations/lifecycle/:key",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const{enabled,delayHours,channel}=request.body||{};if(!["complete_first_test","publish_ready_asset"].includes(request.params.key)||typeof enabled!=="boolean"||!Number.isInteger(delayHours)||delayHours<1||delayHours>720||!["email","in_app"].includes(channel))return response.status(400).json({error:"Valid lifecycle automation controls are required."});try{return response.json({operations:await repository.updateLifecycleAutomation(user.id,request.params.key,{enabled,delayHours,channel})});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Lifecycle automation could not be updated."});}});
app.post("/api/growth-operations/experiments",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const{name,allocationPercent,variants}=request.body||{};if(typeof name!=="string"||name.trim().length<3||name.length>100||!Number.isInteger(allocationPercent)||allocationPercent<1||allocationPercent>100||!Array.isArray(variants)||variants.length<2||variants.length>4||variants.some(v=>typeof v?.key!=="string"||!/^[a-z0-9_-]{1,30}$/i.test(v.key)||typeof v?.label!=="string"||v.label.length<1||v.label.length>60)||new Set(variants.map(v=>v.key)).size!==variants.length)return response.status(400).json({error:"A valid experiment and unique variants are required."});try{return response.status(201).json({operations:await repository.createGrowthExperiment(user.id,{name:name.trim(),allocationPercent,variants})});}catch(error){return response.status(error?.status||502).json({error:error?.message||"Experiment could not be created."});}});
app.patch("/api/growth-operations/experiments/:id",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;const status=request.body?.status;if(!/^[0-9a-f-]{36}$/i.test(request.params.id)||!["running","paused","completed"].includes(status))return response.status(400).json({error:"A valid experiment state is required."});try{return response.json({operations:await repository.setGrowthExperimentStatus(user.id,request.params.id,status)});}catch(error){return response.status(error?.status||502).json({error:error?.message||"Experiment state could not be updated."});}});
app.post("/api/growth-operations/assign",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;if(request.body?.surface!=="creator_primary_cta")return response.status(400).json({error:"A valid experiment surface is required."});try{return response.json({assignment:await repository.assignGrowthVariant(user,"creator_primary_cta")});}catch{return response.status(502).json({error:"Experiment assignment failed."});}});
app.get("/api/growth-operations/in-app",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({messages:await repository.deliverInAppLifecycle(user.id)});}catch{return response.status(502).json({error:"In-app lifecycle messages could not be loaded."});}});
app.get("/api/recovery-verifications",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.json({verifications:await repository.listRecoveryVerifications(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Recovery history could not be loaded."});}});
app.post("/api/recovery-verifications",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;try{return response.status(201).json({verification:await repository.runVerifiedRecovery(user.id)});}catch(error){return response.status(error?.status||502).json({error:error?.status?error.message:"Recovery verification failed."});}});
app.get("/api/recovery-verifications/:id/export",async(request,response)=>{const user=await requireWorkspaceUser(request,response);if(!user)return;if(!/^[0-9a-f-]{36}$/i.test(request.params.id))return response.status(400).json({error:"A valid recovery verification is required."});try{const items=await repository.listRecoveryVerifications(user.id);const item=items.find(x=>x.id===request.params.id);if(!item)return response.status(404).json({error:"Recovery verification not found."});response.setHeader("content-disposition",`attachment; filename="intentos-recovery-${item.id}.json"`);return response.json(item);}catch(error){return response.status(error?.status||502).json({error:"Recovery manifest export failed."});}});

app.get("/api/workspace", async (request, response) => {
  const user = await requireWorkspaceUser(request, response);
  if (!user) return;
  try { return response.json({ workspace: await repository.loadWorkspace(user) }); }
  catch { return response.status(502).json({ error: "Could not load workspace.", code: "DATABASE_ERROR" }); }
});

app.post("/api/workspace/members", async (request, response) => {
  const user = await requireWorkspaceUser(request, response);
  if (!user) return;
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const role = typeof request.body?.role === "string" ? request.body.role.toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !validRole(role)) return response.status(400).json({ error: "A valid email and role are required." });
  try {
    const result = await repository.inviteMember(user, { email, role });
    const appUrl = process.env.APP_URL || "http://localhost:4173";
    const inviteUrl = `${appUrl}?invite=${encodeURIComponent(result.invitation.token)}`;
    let delivery = "manual";
    if (emailProvider) {
      try { await emailProvider.sendInvitation({ to: email, workspaceName: result.workspace.name, inviteUrl, expiresAt: result.invitation.expiresAt }); delivery = "sent"; }
      catch { delivery = "failed"; }
    }
    return response.status(201).json({ workspace: result.workspace, invitation: { url: inviteUrl, expiresAt: result.invitation.expiresAt, delivery } });
  }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 403 ? error.message : "Could not invite member." }); }
});

app.post("/api/workspace/members/:id/resend", async (request, response) => {
  const user = await requireWorkspaceUser(request, response);
  if (!user) return;
  try {
    const result = await repository.resendInvitation(user, request.params.id);
    const appUrl = process.env.APP_URL || "http://localhost:4173";
    const inviteUrl = `${appUrl}?invite=${encodeURIComponent(result.invitation.token)}`;
    let delivery = "manual";
    if (emailProvider) {
      try { await emailProvider.sendInvitation({ to: result.invitation.email, workspaceName: result.workspaceName, inviteUrl, expiresAt: result.invitation.expiresAt }); delivery = "sent"; }
      catch { delivery = "failed"; }
    }
    return response.json({ workspace: result.workspace, invitation: { url: inviteUrl, expiresAt: result.invitation.expiresAt, delivery } });
  } catch (error) { return response.status(error?.status || 502).json({ error: error?.status ? error.message : "Could not resend invitation." }); }
});

app.post("/api/invitations/accept", async (request, response) => {
  const user = await requireWorkspaceUser(request, response);
  if (!user) return;
  const token = typeof request.body?.token === "string" ? request.body.token : "";
  if (token.length < 32 || token.length > 128) return response.status(400).json({ error: "A valid invitation token is required." });
  try { return response.json({ workspace: await repository.acceptInvitation(user, token) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status ? error.message : "Could not accept invitation." }); }
});

app.patch("/api/workspace/members/:id", async (request, response) => {
  const user = await requireWorkspaceUser(request, response);
  if (!user) return;
  const role = typeof request.body?.role === "string" ? request.body.role.toLowerCase() : "";
  if (!validRole(role)) return response.status(400).json({ error: "Editor or viewer role is required." });
  try { return response.json({ workspace: await repository.updateMember(user, request.params.id, role) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 403 ? error.message : "Could not update member." }); }
});

app.delete("/api/workspace/members/:id", async (request, response) => {
  const user = await requireWorkspaceUser(request, response);
  if (!user) return;
  try { return response.json({ workspace: await repository.removeMember(user, request.params.id) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 403 ? error.message : "Could not remove member." }); }
});

app.post("/api/workspace/shares", async (request, response) => {
  const user = await requireWorkspaceUser(request, response);
  if (!user) return;
  const assetId = typeof request.body?.assetId === "string" ? request.body.assetId : "";
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const access = typeof request.body?.access === "string" ? request.body.access.toLowerCase() : "";
  if (!assetId || !/^\S+@\S+\.\S+$/.test(email) || !validRole(access)) return response.status(400).json({ error: "Asset, email, and access level are required." });
  try { return response.status(201).json({ workspace: await repository.shareAsset(user, { assetId, email, access }) }); }
  catch (error) { return response.status(error?.status || 502).json({ error: error?.status === 403 ? error.message : "Could not share asset." }); }
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError) return response.status(400).json({ error: "Invalid JSON payload." });
  return response.status(500).json({ error: "Unexpected server error." });
});

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.use(express.static(path.join(rootDirectory, "dist"), { index: false, maxAge: "1h" }));
app.get("*splat", (request, response, next) => {
  if (request.path.startsWith("/api/") || request.path.startsWith("/scim/")) return next();
  return response.sendFile(path.join(rootDirectory, "dist", "index.html"));
});

const server=app.listen(port, "0.0.0.0", () => {
  console.log(`IntentOS listening on 0.0.0.0:${port}`);
});
server.requestTimeout=30000;
server.headersTimeout=35000;
server.keepAliveTimeout=5000;
