const baseUrl = String(process.env.SMOKE_BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const failures = [];

async function check(name, run) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
const expect = (condition, message) => { if (!condition) throw new Error(message); };

await check("health endpoint", async () => { const response = await fetch(`${baseUrl}/api/health`); const body = await response.json(); expect(response.ok && body.ok === true, `HTTP ${response.status}`); });
await check("readiness contract", async () => { const response = await fetch(`${baseUrl}/api/readiness`); const body = await response.json(); expect([200,503].includes(response.status), `HTTP ${response.status}`); expect(["ready","attention"].includes(body.status) && body.checks, "invalid readiness payload"); });
await check("security headers", async () => { const response = await fetch(`${baseUrl}/api/health`); expect(response.headers.get("x-content-type-options") === "nosniff", "nosniff missing"); expect(response.headers.get("x-frame-options") === "DENY", "frame protection missing"); expect(Boolean(response.headers.get("x-request-id")), "request id missing"); });
await check("invalid generation rejected", async () => { const response = await fetch(`${baseUrl}/api/generate`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({intent:"no",mode:"auto"}) }); expect(response.status === 400, `expected 400, received ${response.status}`); });
await check("protected endpoint rejects anonymous access", async () => { const response = await fetch(`${baseUrl}/api/sla`); expect([401,503].includes(response.status), `expected 401/503, received ${response.status}`); });

console.log(JSON.stringify({ ok: failures.length === 0, baseUrl, checks: 5, failures }, null, 2));
if (failures.length) process.exitCode = 1;
