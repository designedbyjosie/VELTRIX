import { resetRateLimits } from "@/server/rate-limit";
import { db } from "@/server/db";

export const BASE = "http://localhost:3000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx: { params: Promise<any> }) => Promise<Response>;

export interface CallOpts {
  method?: string;
  body?: unknown;
  cookie?: string;
  token?: string;
  origin?: string | null;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export async function call(fn: Handler, path: string, opts: CallOpts = {}) {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { "user-agent": "vitest" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  if (opts.origin !== null && method !== "GET") headers.origin = opts.origin ?? BASE;
  const res = await fn(new Request(url, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }), { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

let n = 0;
export async function newUser(register: Handler, name = "Test User", opts: { verified?: boolean } = {}) {
  await resetRateLimits();
  const email = `user${Date.now()}${n++}@example.com`;
  const r = await call(register, "/api/auth/register", { body: { name, email, password: "correct horse battery", acceptTerms: true } });
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.json)}`);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  if (opts.verified !== false) await db.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  return { email, cookie };
}
