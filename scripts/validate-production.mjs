import "dotenv/config";

const required = [
  "APP_URL",
  "ENTERPRISE_KEY_ENCRYPTION_SECRET",
];
const usingMongo = Boolean(process.env.MONGODB_URI || process.env.MONGO_URL);
required.push(...(usingMongo ? ["AUTH_SECRET", "ADMIN_ACCESS_KEY"] : ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]));
const optional = ["OPENAI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "INVITE_EMAIL_FROM"];
const missing = required.filter((key) => !String(process.env[key] || "").trim());
const invalid = [];
const appUrl = String(process.env.APP_URL || "");
if (appUrl && (!appUrl.startsWith("https://") || /localhost|127\.0\.0\.1/i.test(appUrl))) invalid.push("APP_URL must be a public HTTPS origin");
if (process.env.ENTERPRISE_KEY_ENCRYPTION_SECRET && process.env.ENTERPRISE_KEY_ENCRYPTION_SECRET.length < 32) invalid.push("ENTERPRISE_KEY_ENCRYPTION_SECRET must be at least 32 characters");
if (usingMongo && String(process.env.AUTH_SECRET || "").length < 32) invalid.push("AUTH_SECRET must be at least 32 characters for MongoDB device sessions");
if (usingMongo && String(process.env.ADMIN_ACCESS_KEY || "").length < 24) invalid.push("ADMIN_ACCESS_KEY must be at least 24 characters for the admin control panel");
if (process.env.SUPABASE_URL && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(process.env.SUPABASE_URL)) invalid.push("SUPABASE_URL must be a Supabase HTTPS project URL");
if (process.env.AGENT_HTTP_ALLOWLIST && process.env.AGENT_HTTP_ALLOWLIST.split(",").some((host) => !/^[a-z0-9.-]+$/i.test(host.trim()))) invalid.push("AGENT_HTTP_ALLOWLIST must contain hostnames only");

const result = { ok: missing.length === 0 && invalid.length === 0, missing, invalid, optionalMissing: optional.filter((key) => !process.env[key]) };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
