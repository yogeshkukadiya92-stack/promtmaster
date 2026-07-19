const MAX_RESPONSE_BYTES = 256 * 1024;
const TIMEOUT_MS = Math.max(1000, Number(process.env.AGENT_TOOL_TIMEOUT_MS || 8000));

const hostAllowlist = new Set((process.env.AGENT_HTTP_ALLOWLIST || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
const assertString = (value, name, min, max) => {
  if (typeof value !== "string" || value.length < min || value.length > max) throw Object.assign(new Error(`${name} is invalid.`), { code: "INVALID_INPUT" });
};

const readLimited = async (response) => {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw Object.assign(new Error("Tool response exceeded the size limit."), { code: "RESPONSE_TOO_LARGE" }); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
};

const tools = {
  "workspace.context": {
    risk: "read", permission: "workspace",
    validate(input) { assertString(input.mission, "mission", 12, 500); assertString(input.agentTitle, "agentTitle", 3, 100); },
    async execute(input) { return { agent: input.agentTitle, mission: input.mission, contextType: "run-scoped", source: "authenticated-workspace" }; },
  },
  "workspace.note.create": {
    risk: "write", permission: "external", requiresApproval: true,
    validate(input) { assertString(input.content, "content", 3, 1000); },
    async execute(input, services) {
      if (!services?.createWorkspaceNote) throw Object.assign(new Error("Workspace note service is unavailable."), { code: "SERVICE_UNAVAILABLE" });
      return services.createWorkspaceNote(input.content);
    },
  },
  "memory.remember": {
    risk: "write", permission: "external", requiresApproval: true,
    validate(input) {
      assertString(input.content, "content", 3, 1000);
      if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 365) throw Object.assign(new Error("retentionDays is invalid."), { code: "INVALID_INPUT" });
    },
    async execute(input, services) {
      if (!services?.rememberMemory) throw Object.assign(new Error("Memory service is unavailable."), { code: "SERVICE_UNAVAILABLE" });
      return services.rememberMemory(input.content, input.retentionDays);
    },
  },
  "http.fetch": {
    risk: "external", permission: "web",
    validate(input) {
      assertString(input.url, "url", 10, 2048);
      const url = new URL(input.url);
      if (url.protocol !== "https:" || !hostAllowlist.has(url.hostname.toLowerCase()) || url.username || url.password) throw Object.assign(new Error("URL is not on the HTTPS host allowlist."), { code: "HOST_BLOCKED" });
    },
    async execute(input) {
      const response = await fetch(input.url, { headers: { accept: "text/plain,application/json,text/html", "user-agent": "IntentOS-Agent/1.0" }, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw Object.assign(new Error(`Upstream returned ${response.status}.`), { code: "UPSTREAM_ERROR" });
      const text = await readLimited(response);
      return { url: input.url, status: response.status, contentType: response.headers.get("content-type") || "unknown", excerpt: text.replace(/\s+/g, " ").slice(0, 4000) };
    },
  },
};

const urlFromMission = (mission) => mission.match(/https:\/\/[^\s<>"']+/i)?.[0]?.replace(/[),.;]+$/, "");
const noteFromMission = (mission) => mission.match(/save note:\s*(.{3,1000})/i)?.[1]?.trim();
const memoryFromMission = (mission) => mission.match(/remember:\s*(.{3,1000})/i)?.[1]?.trim();

export function buildToolPlan(run) {
  const plan = [];
  if (run.permissions?.workspace) plan.push({ name: "workspace.context", input: { agentTitle: run.agent_title, mission: run.mission } });
  const url = run.permissions?.web ? urlFromMission(run.mission) : null;
  if (url) plan.push({ name: "http.fetch", input: { url } });
  const note = run.permissions?.external ? noteFromMission(run.mission) : null;
  if (note) plan.push({ name: "workspace.note.create", input: { content: note } });
  const memory = run.permissions?.external ? memoryFromMission(run.mission) : null;
  if (memory) plan.push({ name: "memory.remember", input: { content: memory, retentionDays: 30 } });
  return plan;
}

export const toolRequiresApproval = (name) => Boolean(tools[name]?.requiresApproval);
export const toolRiskLevel = (name) => tools[name]?.risk || "external";

export async function executeToolCall(call, permissions, services = {}) {
  const tool = tools[call.name];
  const started = Date.now();
  if (!tool) return { toolName: call.name, riskLevel: "external", status: "blocked", input: call.input, output: null, errorCode: "TOOL_NOT_REGISTERED", durationMs: 0 };
  if (!permissions?.[tool.permission]) return { toolName: call.name, riskLevel: tool.risk, status: "blocked", input: call.input, output: null, errorCode: "PERMISSION_DENIED", durationMs: 0 };
  if (tool.requiresApproval && services.scopedApproval !== true) return { toolName: call.name, riskLevel: tool.risk, status: "blocked", input: call.input, output: null, errorCode: "SCOPED_APPROVAL_REQUIRED", durationMs: 0 };
  try {
    tool.validate(call.input);
    const output = await tool.execute(call.input, services);
    return { toolName: call.name, riskLevel: tool.risk, status: "completed", input: call.input, output, errorCode: null, durationMs: Date.now() - started };
  } catch (error) {
    return { toolName: call.name, riskLevel: tool.risk, status: error?.code === "HOST_BLOCKED" ? "blocked" : "failed", input: call.input, output: null, errorCode: error?.code || error?.name || "TOOL_ERROR", durationMs: Date.now() - started };
  }
}

export const registeredTools = Object.keys(tools);

export function validateToolPlan(calls, permissions) {
  if (!Array.isArray(calls) || calls.length > 5) throw Object.assign(new Error("Tool plan is invalid."), { code: "INVALID_PLAN" });
  const seen = new Set();
  return calls.map((call) => {
    const tool = tools[call?.name];
    if (!tool || !permissions?.[tool.permission]) throw Object.assign(new Error("Tool plan exceeds granted permissions."), { code: "PLAN_PERMISSION_DENIED" });
    if (seen.has(call.name)) throw Object.assign(new Error("Duplicate tool actions are not allowed."), { code: "INVALID_PLAN" });
    seen.add(call.name);
    tool.validate(call.input);
    return { name: call.name, input: call.input };
  });
}
