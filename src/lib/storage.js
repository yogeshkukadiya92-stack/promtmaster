const STORAGE_KEY = "intentos.assets.v1";
const VERSION_KEY = "intentos.versions.v1";
const TEST_SUITE_KEY = "intentos.test-suites.v1";
const RUN_HISTORY_KEY = "intentos.run-history.v1";
const COLLABORATION_KEY = "intentos.collaboration.v1";

export function loadAssets() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAssets(assets) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
}

export function loadVersionHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VERSION_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveVersionHistory(history) {
  window.localStorage.setItem(VERSION_KEY, JSON.stringify(history));
}

export function loadTestSuites() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEST_SUITE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveTestSuites(suites) {
  window.localStorage.setItem(TEST_SUITE_KEY, JSON.stringify(suites));
}

export function loadRunHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RUN_HISTORY_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRunHistory(history) {
  window.localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history));
}

export function loadCollaboration() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COLLABORATION_KEY) || "null");
    if (parsed?.members && parsed?.shares && parsed?.activity) return parsed;
  } catch {
    // Start with a clean local workspace when stored data is invalid.
  }
  return {
    id: crypto.randomUUID(),
    name: "Yogesh AI Workspace",
    members: [{ id: crypto.randomUUID(), email: "you@workspace.local", name: "You", role: "Owner", status: "Active" }],
    shares: [],
    activity: [],
  };
}

export function saveCollaboration(workspace) {
  window.localStorage.setItem(COLLABORATION_KEY, JSON.stringify(workspace));
}

export function exportAsset(asset) {
  const blob = new Blob([JSON.stringify(asset, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${asset.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function loadCloudAssets(accessToken) {
  if (!accessToken) return [];
  const response = await fetch("/api/assets", { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload.assets) ? payload.assets : [];
}

export async function deleteCloudAsset(id, accessToken) {
  if (!accessToken) return;
  await fetch(`/api/assets/${encodeURIComponent(id)}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } });
}

export async function saveCloudAsset(asset, accessToken) {
  if (!accessToken || !asset) return null;
  const response = await fetch("/api/assets", { method: "POST", headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ asset }) });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.asset || null;
}

const workspaceRequest = async (path, accessToken, options = {}) => {
  if (!accessToken) return null;
  const response = await fetch(path, {
    ...options,
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}) },
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.workspace || null;
};

export const loadCloudWorkspace = (accessToken) => workspaceRequest("/api/workspace", accessToken);
export async function inviteCloudMember(accessToken, email, role) {
  if (!accessToken) return null;
  const response = await fetch("/api/workspace/members", { method: "POST", headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ email, role }) });
  if (!response.ok) return null;
  return response.json();
}
export const acceptCloudInvitation = (accessToken, token) => workspaceRequest("/api/invitations/accept", accessToken, { method: "POST", body: JSON.stringify({ token }) });
export const updateCloudMember = (accessToken, id, role) => workspaceRequest(`/api/workspace/members/${encodeURIComponent(id)}`, accessToken, { method: "PATCH", body: JSON.stringify({ role }) });
export const removeCloudMember = (accessToken, id) => workspaceRequest(`/api/workspace/members/${encodeURIComponent(id)}`, accessToken, { method: "DELETE" });
export async function resendCloudInvitation(accessToken, id) {
  if (!accessToken) return null;
  const response = await fetch(`/api/workspace/members/${encodeURIComponent(id)}/resend`, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } });
  return response.ok ? response.json() : null;
}
export const shareCloudAsset = (accessToken, assetId, email, access) => workspaceRequest("/api/workspace/shares", accessToken, { method: "POST", body: JSON.stringify({ assetId, email, access }) });
