const KEY = "intentos.agent-executions.v1";

export function loadAgentExecutions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export const saveAgentExecutions = (runs) => localStorage.setItem(KEY, JSON.stringify(runs));

const executionRequest = async (path, accessToken, options = {}) => {
  if (!accessToken) return null;
  const response = await fetch(path, { ...options, headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) } });
  if (!response.ok) return null;
  return response.json();
};

export async function loadCloudAgentExecutions(accessToken) {
  const payload = await executionRequest("/api/agent-runs", accessToken);
  return payload?.runs || [];
}

export async function createCloudExecution(accessToken, agent, mission, permissions, idempotencyKey) {
  const payload = await executionRequest("/api/agent-runs", accessToken, { method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify({ agentId: agent.id, agentTitle: agent.title, mission, permissions }) });
  return payload?.run || null;
}

export async function decideCloudExecution(accessToken, runId, approved) {
  const payload = await executionRequest(`/api/agent-runs/${encodeURIComponent(runId)}/decision`, accessToken, { method: "POST", body: JSON.stringify({ decision: approved ? "approve" : "reject" }) });
  return payload?.run || null;
}

export async function cancelCloudExecution(accessToken, runId) {
  const payload = await executionRequest(`/api/agent-runs/${encodeURIComponent(runId)}/cancel`, accessToken, { method: "POST" });
  return payload?.run || null;
}

export async function retryCloudExecution(accessToken, runId) {
  const payload = await executionRequest(`/api/agent-runs/${encodeURIComponent(runId)}/retry`, accessToken, { method: "POST" });
  return payload?.run || null;
}

export async function decideActionCloudExecution(accessToken, approvalId, approved) {
  const payload = await executionRequest(`/api/agent-action-approvals/${encodeURIComponent(approvalId)}/decision`, accessToken, { method: "POST", body: JSON.stringify({ decision: approved ? "approve" : "reject" }) });
  return payload?.run || null;
}

export async function loadAgentSchedules(accessToken) {
  const payload = await executionRequest("/api/agent-schedules", accessToken);
  return payload?.schedules || [];
}

export async function createAgentSchedule(accessToken, input) {
  const payload = await executionRequest("/api/agent-schedules", accessToken, { method: "POST", body: JSON.stringify(input) });
  return payload?.schedule || null;
}

export async function setAgentScheduleActive(accessToken, scheduleId, active) {
  const payload = await executionRequest(`/api/agent-schedules/${encodeURIComponent(scheduleId)}`, accessToken, { method: "PATCH", body: JSON.stringify({ active }) });
  return payload?.schedule || null;
}

export async function deleteAgentSchedule(accessToken, scheduleId) {
  if (!accessToken) return false;
  const response = await fetch(`/api/agent-schedules/${encodeURIComponent(scheduleId)}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } });
  return response.ok;
}

export async function loadAgentMemories(accessToken) {
  const payload = await executionRequest("/api/agent-memories", accessToken);
  return payload?.memories || [];
}

export async function loadAgentOperations(accessToken) {
  const payload = await executionRequest("/api/agent-operations", accessToken);
  return payload?.operations || null;
}

export async function deleteAgentMemory(accessToken, memoryId) {
  if (!accessToken) return false;
  const response = await fetch(`/api/agent-memories/${encodeURIComponent(memoryId)}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } });
  return response.ok;
}

export function createExecution(agent, mission, permissions) {
  const startedAt = new Date().toISOString();
  return {
    id: crypto.randomUUID(), agentId: agent.id, agentTitle: agent.title, mission,
    status: "Awaiting approval", stage: "approval", startedAt, finishedAt: null,
    duration: "—", cost: "₹0", permissions,
    events: [
      { id: crypto.randomUUID(), tone: "success", text: "Request understood", at: startedAt },
      { id: crypto.randomUUID(), tone: "success", text: "Execution plan prepared", at: startedAt },
      { id: crypto.randomUUID(), tone: "warning", text: "Human approval requested", at: startedAt },
    ],
  };
}

export function finishExecution(run, approved) {
  const finishedAt = new Date().toISOString();
  if (!approved) return { ...run, status: "Rejected", stage: "rejected", finishedAt, duration: "0:08", events: [{ id: crypto.randomUUID(), tone: "danger", text: "Execution rejected by reviewer", at: finishedAt }, ...run.events] };
  return {
    ...run, status: "Completed", stage: "completed", finishedAt, duration: "0:42", cost: "₹4.20",
    events: [
      { id: crypto.randomUUID(), tone: "success", text: "Outcome verified and run completed", at: finishedAt },
      { id: crypto.randomUUID(), tone: "live", text: "Approved actions executed", at: finishedAt },
      { id: crypto.randomUUID(), tone: "success", text: "Human approval granted", at: finishedAt },
      ...run.events,
    ],
  };
}

export function cancelExecution(run) {
  const finishedAt = new Date().toISOString();
  return { ...run, status: "Cancelled", stage: "cancelled", finishedAt, events: [{ id: crypto.randomUUID(), tone: "danger", text: "Run cancelled by user", at: finishedAt }, ...run.events] };
}
