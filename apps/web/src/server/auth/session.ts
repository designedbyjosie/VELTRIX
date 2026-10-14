import { db } from "../db";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "vx_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const API_TOKEN_PREFIX = "vxt_";

export interface AuthContext {
  userId: string;
  kind: "session" | "token";
  sessionId?: string;
  tokenId?: string;
  scopes: string[];
}

export async function createSession(userId: string, userAgent: string | null) {
  const token = randomToken();
  const session = await db.session.create({
    data: { userId, tokenHash: sha256(token), userAgent: userAgent?.slice(0, 200) ?? null, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return { token, session };
}

export async function resolveSession(token: string | null | undefined): Promise<AuthContext | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session || session.expiresAt < new Date()) return null;
  // Sliding activity timestamp, at most once an hour.
  if (Date.now() - session.lastSeenAt.getTime() > 3_600_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return { userId: session.userId, kind: "session", sessionId: session.id, scopes: ["*"] };
}

export async function destroySession(token: string | null | undefined) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function createApiToken(userId: string, name: string, scopes: string[]) {
  const token = `${API_TOKEN_PREFIX}${randomToken()}`;
  const record = await db.apiToken.create({
    data: { userId, name, scopes, tokenHash: sha256(token), prefix: token.slice(0, 10), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return { token, record };
}

export async function resolveApiToken(token: string | null | undefined): Promise<AuthContext | null> {
  if (!token || !token.startsWith(API_TOKEN_PREFIX) || token.length > 200) return null;
  const record = await db.apiToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 300_000) {
    await db.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { userId: record.userId, kind: "token", tokenId: record.id, scopes: record.scopes };
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
