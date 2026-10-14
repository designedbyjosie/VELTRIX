/**
 * Route-handler wrapper used by every API endpoint. It centralizes:
 *   - authentication (session cookie, or extension bearer token where allowed)
 *   - CSRF defense for cookie-authenticated mutations (Origin must match)
 *   - rate limiting
 *   - zod validation of JSON bodies and query strings
 *   - consistent JSON errors that never leak internals
 * Handlers are plain (Request) => Response functions so they are directly testable.
 */
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { Prisma } from "@prisma/client";
import { env } from "./env";
import { HttpError, unauthorized, forbidden } from "./errors";
import { rateLimit } from "./rate-limit";
import { audit } from "./audit";
import { readCookie, resolveApiToken, resolveSession, SESSION_COOKIE, type AuthContext } from "./auth/session";

type AuthMode = "session" | "session-or-token" | "none";

export interface HandlerOptions<B, Q> {
  auth?: AuthMode;
  /** Required scope when authenticated by API token. */
  scope?: string;
  body?: ZodType<B, ZodTypeDef, unknown>;
  query?: ZodType<Q, ZodTypeDef, unknown>;
  rateLimit?: { key: string; limit: number; windowMs: number; by?: "ip" | "user" };
}

export interface HandlerContext<B, Q, P> {
  req: Request;
  auth: AuthContext;
  body: B;
  query: Q;
  params: P;
  ip: string | null;
  userAgent: string | null;
}

type RouteParams<P> = { params: Promise<P> };

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...(init.headers ?? {}) },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  if (err instanceof ZodError) {
    return json(
      { error: { code: "validation_error", message: "Some fields need attention.", fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
      { status: 422 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return json({ error: { code: "conflict", message: "That record already exists." } }, { status: 409 });
    if (err.code === "P2025") return json({ error: { code: "not_found", message: "Record not found." } }, { status: 404 });
  }
  console.error("[api] unhandled error", err);
  return json({ error: { code: "internal_error", message: "Something went wrong on our side. Try again." } }, { status: 500 });
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Cookie-authenticated mutations must come from our own origin. */
function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-site POST; a missing Origin means a same-origin
    // navigation or a non-browser client, which cannot ride on a victim's cookie via CSRF.
    const site = req.headers.get("sec-fetch-site");
    return !site || site === "same-origin" || site === "none";
  }
  const allowed = new Set([new URL(env.appUrl).origin]);
  try {
    allowed.add(new URL(req.url).origin);
  } catch {
    /* ignore */
  }
  return allowed.has(origin);
}

export async function authenticate(req: Request, mode: AuthMode): Promise<AuthContext | null> {
  if (mode === "none") return null;
  const authz = req.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    if (mode !== "session-or-token") throw forbidden("This endpoint can't be used with an extension token.");
    const ctx = await resolveApiToken(authz.slice(7).trim());
    if (!ctx) throw unauthorized("Your extension connection has expired. Reconnect it from VELTRIX settings.");
    return ctx;
  }
  return resolveSession(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}

export function handler<B = undefined, Q = undefined, P = Record<string, string>>(
  opts: HandlerOptions<B, Q>,
  fn: (ctx: HandlerContext<B, Q, P>) => Promise<Response | unknown>,
) {
  return async (req: Request, route?: RouteParams<P>): Promise<Response> => {
    try {
      const ip = clientIp(req);
      const userAgent = req.headers.get("user-agent");
      const mode = opts.auth ?? "session";
      const auth = await authenticate(req, mode);
      if (mode !== "none" && !auth) throw unauthorized();
      if (auth?.kind === "token" && opts.scope && !auth.scopes.includes(opts.scope)) throw forbidden("This token isn't allowed to do that.");

      if (auth?.kind === "session" && MUTATING.has(req.method) && !originAllowed(req)) {
        await audit("security.origin_rejected", { userId: auth.userId, ip, userAgent, metadata: { origin: req.headers.get("origin") ?? "" } });
        throw forbidden("Request origin not allowed.");
      }
      if (mode === "none" && MUTATING.has(req.method) && req.headers.get("origin") && !originAllowed(req) && !req.headers.get("origin")?.startsWith("chrome-extension://")) {
        throw forbidden("Request origin not allowed.");
      }

      if (opts.rateLimit) {
        const who = opts.rateLimit.by === "user" && auth ? auth.userId : ip ?? "unknown";
        const r = rateLimit(`${opts.rateLimit.key}:${who}`, opts.rateLimit.limit, opts.rateLimit.windowMs);
        if (!r.ok) {
          await audit("security.rate_limited", { userId: auth?.userId, ip, userAgent, metadata: { key: opts.rateLimit.key } });
          return json(
            { error: { code: "rate_limited", message: `Too many requests. Try again in ${r.retryAfterSeconds} seconds.` } },
            { status: 429, headers: { "retry-after": String(r.retryAfterSeconds) } },
          );
        }
      }

      let body = undefined as B;
      if (opts.body) {
        const len = Number(req.headers.get("content-length") ?? 0);
        if (len > 3_000_000) throw new HttpError(413, "too_large", "Request body is too large.");
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
        }
        body = opts.body.parse(raw);
      }
      let query = undefined as Q;
      if (opts.query) {
        const url = new URL(req.url);
        query = opts.query.parse(Object.fromEntries(url.searchParams.entries()));
      }
      const params = (route?.params ? await route.params : {}) as P;
      const result = await fn({ req, auth: auth as AuthContext, body, query, params, ip, userAgent });
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
