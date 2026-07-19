import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const secret = () => String(process.env.AUTH_SECRET || "");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function sessionTokensReady() {
  return secret().length >= 32;
}

export function createDeviceSession(userInput = "") {
  if (!sessionTokensReady()) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  const supplied = typeof userInput === "object" && userInput ? userInput : null;
  const user = {
    id: /^[0-9a-f-]{36}$/i.test(supplied?.id || userInput) ? (supplied?.id || userInput) : randomUUID(),
    email: supplied?.email || "Private device workspace",
    name: supplied?.name || "",
  };
  const payload = encode({ sub: user.id, email: user.email, name: user.name, role: "user", iat: Date.now(), exp: Date.now() + 30 * 24 * 60 * 60 * 1000, v: 1 });
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { access_token: `${payload}.${signature}`, user };
}

export function adminAccessReady() {
  return sessionTokensReady() && String(process.env.ADMIN_ACCESS_KEY || "").length >= 24;
}

export function verifyAdminAccessKey(value) {
  if (!adminAccessReady() || typeof value !== "string") return false;
  const expected = Buffer.from(String(process.env.ADMIN_ACCESS_KEY));
  const received = Buffer.from(value);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function createAdminSession() {
  if (!adminAccessReady()) throw new Error("ADMIN_ACCESS_KEY must contain at least 24 characters.");
  const user = { id: "platform-admin", email: "IntentOS administrator", role: "admin" };
  const payload = encode({ sub: user.id, email: user.email, role: user.role, iat: Date.now(), exp: Date.now() + 8 * 60 * 60 * 1000, v: 1 });
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { access_token: `${payload}.${signature}`, expires_in: 28800, user };
}

export function verifyDeviceSession(token) {
  if (!sessionTokensReady() || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let received;
  try { received = Buffer.from(signature, "base64url"); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const normalUser = /^[0-9a-f-]{36}$/i.test(decoded.sub) && decoded.role !== "admin";
    const administrator = decoded.sub === "platform-admin" && decoded.role === "admin";
    if ((!normalUser && !administrator) || decoded.v !== 1 || (decoded.exp && decoded.exp <= Date.now())) return null;
    return { id: decoded.sub, email: decoded.email || "Private device workspace", name: decoded.name || "", role: administrator ? "admin" : "user" };
  } catch { return null; }
}

export function verifyAdminSession(token) {
  const user = verifyDeviceSession(token);
  return user?.role === "admin" ? user : null;
}
