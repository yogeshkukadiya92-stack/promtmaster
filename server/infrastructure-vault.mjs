import { createCipheriv, createHash, randomBytes } from "node:crypto";
const secret=process.env.ENTERPRISE_KEY_ENCRYPTION_SECRET||"";
const key=secret.length>=32?createHash("sha256").update(secret).digest():null;
export const infrastructureVaultReady=Boolean(key);
export function encryptProviderKey(value){if(!key)throw Object.assign(new Error("Enterprise key vault is not configured."),{code:"VAULT_UNAVAILABLE",status:503});const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",key,iv);const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return{ciphertext:encrypted.toString("base64"),iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),lastFour:value.slice(-4)};}
