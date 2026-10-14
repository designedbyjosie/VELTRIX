import { describe, expect, it, beforeEach } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as listAccounts, POST as createAccount } from "@/app/api/accounts/route";
import { db } from "@/server/db";
import { resetRateLimits } from "@/server/rate-limit";
import { call, newUser } from "./helpers";

beforeEach(() => resetRateLimits());

describe("authentication", () => {
  it("registers, sets an HttpOnly session cookie and stores only a password hash", async () => {
    const email = `reg${Date.now()}@example.com`;
    const r = await call(register, "/api/auth/register", { body: { name: "Alex", email, password: "correct horse battery", acceptTerms: true } });
    expect(r.status).toBe(201);
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toMatch(/vx_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toContain("correct horse");
    expect(user.passwordHash.startsWith("$2")).toBe(true);
    const session = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(cookie).not.toContain(session.tokenHash);
  });

  it("rejects duplicate emails, weak passwords and missing consent", async () => {
    const { email } = await newUser(register);
    expect((await call(register, "/api/auth/register", { body: { name: "X", email, password: "correct horse battery", acceptTerms: true } })).status).toBe(409);
    expect((await call(register, "/api/auth/register", { body: { name: "X", email: "a@b.co", password: "short", acceptTerms: true } })).status).toBe(422);
    expect((await call(register, "/api/auth/register", { body: { name: "X", email: "c@d.co", password: "correct horse battery", acceptTerms: false } })).status).toBe(422);
  });

  it("logs in with the right password only", async () => {
    const { email } = await newUser(register);
    expect((await call(login, "/api/auth/login", { body: { email, password: "wrong password!!" } })).status).toBe(401);
    const ok = await call(login, "/api/auth/login", { body: { email, password: "correct horse battery" } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/vx_session=/);
  });

  it("does not reveal whether an email exists", async () => {
    const r = await call(login, "/api/auth/login", { body: { email: "nobody@example.com", password: "whatever12345" } });
    expect(r.status).toBe(401);
    expect(r.json.error.message).toBe("That email and password combination didn't match.");
  });

  it("rate-limits repeated failures for one account", async () => {
    const { email } = await newUser(register);
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await call(login, "/api/auth/login", { body: { email, password: "nope-nope-nope" } })).status;
    expect(last).toBe(429);
  });

  it("requires a session for protected endpoints and invalidates it on logout", async () => {
    expect((await call(listAccounts, "/api/accounts")).status).toBe(401);
    const { cookie } = await newUser(register);
    expect((await call(listAccounts, "/api/accounts", { cookie })).status).toBe(200);
    expect((await call(logout, "/api/auth/logout", { cookie, body: {} })).status).toBe(200);
    expect((await call(listAccounts, "/api/accounts", { cookie })).status).toBe(401);
  });

  it("rejects cross-site mutations (CSRF) even with a valid cookie", async () => {
    const { cookie } = await newUser(register);
    const r = await call(createAccount, "/api/accounts", { cookie, origin: "https://evil.example", body: { name: "Hack", type: "CHECKING", balance: "1.00" } });
    expect(r.status).toBe(403);
    expect(await db.connectedAccount.count({ where: { name: "Hack" } })).toBe(0);
  });

  it("rejects a forged session token", async () => {
    expect((await call(listAccounts, "/api/accounts", { cookie: "vx_session=forged-token-value" })).status).toBe(401);
  });
});
