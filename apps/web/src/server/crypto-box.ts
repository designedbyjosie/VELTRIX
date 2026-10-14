/**
 * Authenticated encryption (AES-256-GCM) for secrets stored in the database:
 * two-factor secrets and bank-connection access tokens.
 * Format: v1:<iv b64url>:<tag b64url>:<ciphertext b64url>
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";
import { HttpError } from "./errors";

let warned = false;

function key(): Buffer {
  if (env.encryptionKey) {
    const k = Buffer.from(env.encryptionKey, "base64");
    if (k.length !== 32) throw new HttpError(500, "config_error", "ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    return k;
  }
  if (env.isProduction) throw new HttpError(503, "not_configured", "This feature needs ENCRYPTION_KEY to be configured on the server.");
  if (!warned) {
    console.warn("[veltrix] ENCRYPTION_KEY is not set; using an insecure development key. Never do this in production.");
    warned = true;
  }
  return createHash("sha256").update("veltrix-insecure-development-key").digest();
}

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

export function open(sealed: string): string {
  const [v, iv, tag, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognized sealed value.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
