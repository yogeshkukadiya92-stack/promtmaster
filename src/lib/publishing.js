const KEY = "intentos-marketplace-listings-v1";

export function loadListings() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function saveListings(listings) {
  localStorage.setItem(KEY, JSON.stringify(listings));
}

export function scanListing(listing, asset) {
  const checks = [
    { id: "schema", label: "Capability schema", passed: Boolean(asset?.title && asset?.summary && asset?.sections?.length) },
    { id: "description", label: "Listing description", passed: listing.description.trim().length >= 40 },
    { id: "permissions", label: "Permission disclosure", passed: listing.permissions.length > 0 },
    { id: "cost", label: "Cost expectation", passed: Boolean(listing.cost) },
    { id: "platform", label: "Supported platform", passed: Boolean(listing.platform) },
  ];
  const risk = listing.permissions.includes("External API access") || listing.permissions.includes("Workspace data") ? "medium" : "low";
  return { checks, passed: checks.every((check) => check.passed), risk, scannedAt: new Date().toISOString() };
}

export function newListing(asset) {
  return {
    id: crypto.randomUUID(), assetId: asset.id, title: asset.title, type: asset.type,
    description: asset.summary || "", category: "Productivity", visibility: "Public",
    permissions: ["User-provided input"], cost: "Free", platform: "OpenAI-compatible",
    status: "Draft", scan: null, submittedAt: null, updatedAt: new Date().toISOString(),
  };
}
