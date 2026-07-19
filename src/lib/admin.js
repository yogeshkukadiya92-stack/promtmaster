const tokenKey = "intentos.admin.session.v1";

export const getAdminToken = () => window.sessionStorage.getItem(tokenKey) || "";
export const clearAdminToken = () => window.sessionStorage.removeItem(tokenKey);

const request = async (path, options = {}) => {
  const token = getAdminToken();
  const response = await fetch(path, { ...options, headers: { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  if (response.status === 401) clearAdminToken();
  return response;
};

export async function createAdminAccess(accessKey) {
  const response = await fetch("/api/admin/session", { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ accessKey }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Admin sign-in failed.");
  window.sessionStorage.setItem(tokenKey, payload.session.access_token);
  return payload.session;
}

export async function loadAdminOverview({ query = "", status = "all", offset = 0 } = {}) {
  const response = await request(`/api/admin/overview?query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&offset=${offset}`);
  if (!response.ok) return null;
  return (await response.json()).overview;
}

export async function updateAdminUser(id, input) {
  const response = await request(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
  if (!response.ok) return null;
  return (await response.json()).user;
}

export async function createAdminBackup(id) {
  const response = await request(`/api/admin/users/${encodeURIComponent(id)}/backups`, { method: "POST" });
  if (!response.ok) return null;
  return (await response.json()).backup;
}

export async function exportAdminUser(id) {
  const response = await request(`/api/admin/users/${encodeURIComponent(id)}/export`);
  if (!response.ok) return false;
  const blob = await response.blob(), url = URL.createObjectURL(blob), disposition = response.headers.get("content-disposition") || "", match = disposition.match(/filename="([^"]+)"/), anchor = document.createElement("a");
  anchor.href = url; anchor.download = match?.[1] || `intentos-user-${id.slice(0, 8)}.json`; anchor.click(); URL.revokeObjectURL(url); return true;
}
