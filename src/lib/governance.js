const request = async (accessToken, options = {}) => {
  if (!accessToken) return null;
  const response = await fetch("/api/governance", { ...options, headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}) } });
  if (!response.ok) return null;
  return (await response.json()).governance;
};

export const loadGovernance = (accessToken) => request(accessToken);
export const saveGovernance = (accessToken, policy) => request(accessToken, { method: "PATCH", body: JSON.stringify(policy) });

export async function downloadAuditExport(accessToken, format = "json") {
  const response = await fetch(`/api/governance/audit-export?format=${format}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return false;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `intentos-audit-${new Date().toISOString().slice(0,10)}.${format}`; anchor.click(); URL.revokeObjectURL(url);
  return true;
}
