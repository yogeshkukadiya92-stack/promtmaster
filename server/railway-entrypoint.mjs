const serviceName = String(process.env.RAILWAY_SERVICE_NAME || "").trim().toLowerCase();

if (serviceName === "intentos-worker") await import("./agent-worker.mjs");
else await import("./index.mjs");
