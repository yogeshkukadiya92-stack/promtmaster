const KEY = "intentos-marketplace-purchases-v1";
export const loadPurchases = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export const savePurchases = (items) => localStorage.setItem(KEY, JSON.stringify(items));
export const PLATFORM_FEE_RATE = 0.15;
export const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
export async function createCheckoutSession(assetId, accessToken = "") {
  const response = await fetch("/api/payments/checkout", { method: "POST", headers: { "content-type": "application/json", accept: "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ assetId }) });
  if (response.status === 503) return null;
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Checkout could not be started.");
  }
  return (await response.json()).session;
}
export async function loadCloudEntitlements(accessToken) {
  if (!accessToken) return [];
  const response = await fetch("/api/payments/entitlements", { headers: { accept: "application/json", authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return [];
  return (await response.json()).purchases || [];
}
