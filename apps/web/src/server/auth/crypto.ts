import { createHash, randomBytes, randomInt } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Human-friendly one-time code, e.g. "K7QF-2MXP". */
export function pairingCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizePairingCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Hash an IP so audit logs can correlate abuse without storing raw addresses. */
export function ipHash(ip: string | null): string | null {
  if (!ip) return null;
  return sha256(`veltrix-ip:${ip}`).slice(0, 24);
}
