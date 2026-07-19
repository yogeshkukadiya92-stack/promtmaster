import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const secret = () => String(process.env.AUTH_SECRET || "");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function sessionTokensReady() {
  return secret().length >= 32;
}

export function createDeviceSession(existingUserId = "") {
  if (!sessionTokensReady()) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  const user = {
    id: /^[0-9a-f-]{36}$/i.test(existingUserId) ? existingUserId : randomUUID(),
    email: "Private device workspace",
  };
  const payload = encode({ sub: user.id, email: user.email, iat: Date.now(), v: 1 });
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { access_token: `${payload}.${signature}`, user };
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
    if (!/^[0-9a-f-]{36}$/i.test(decoded.sub) || decoded.v !== 1) return null;
    return { id: decoded.sub, email: decoded.email || "Private device workspace" };
  } catch { return null; }
}
