import { describe, expect, it, beforeEach } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginMfa } from "@/app/api/auth/login/mfa/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { POST as resend } from "@/app/api/auth/resend-verification/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { POST as mfaSetup } from "@/app/api/settings/mfa/route";
import { POST as mfaEnable } from "@/app/api/settings/mfa/enable/route";
import { POST as mfaDisable } from "@/app/api/settings/mfa/disable/route";
import { GET as listAccounts } from "@/app/api/accounts/route";
import { POST as pairingCode } from "@/app/api/extension/pairing-code/route";
import { db } from "@/server/db";
import { outbox } from "@/server/mail";
import { resetRateLimits } from "@/server/rate-limit";
import { currentStep, totpAt, base32Decode, base32Encode, verifyTotp } from "@/server/auth/totp";
import { open, seal } from "@/server/crypto-box";
import { call, newUser } from "./helpers";

const linkToken = (text: string, path: string) => new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`).exec(text)?.[1] ?? null;
const lastMailTo = (to: string) => [...outbox].reverse().find((m) => m.to === to)!;

beforeEach(async () => {
  await resetRateLimits();
});

describe("TOTP and encryption primitives", () => {
  it("matches the RFC 6238 test vector", () => {
    // RFC 6238 SHA-1 secret "12345678901234567890" at T=59s → 287082 (last 6 of 94287082)
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totpAt(secret, Math.floor(59 / 30))).toBe("287082");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    expect(verifyTotp(secret, "287082", 59_000)).toBe(1);
    expect(verifyTotp(secret, "000000", 59_000)).toBeNull();
  });
  it("round-trips sealed secrets and detects tampering", () => {
    const sealed = seal("access-sandbox-abc");
    expect(sealed).not.toContain("access-sandbox");
    expect(open(sealed)).toBe("access-sandbox-abc");
    const parts = sealed.split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => open(parts.join(":"))).toThrow();
  });
});

describe("email verification", () => {
  it("blocks the app until the emailed link is used, then unlocks it", async () => {
    const u = await newUser(register, "Vera", { verified: false });
    const mail = lastMailTo(u.email);
    expect(mail.subject).toMatch(/Confirm your email/);
    expect((await call(listAccounts, "/api/accounts", { cookie: u.cookie })).json.error.code).toBe("email_unverified");
    expect((await call(pairingCode, "/api/extension/pairing-code", { cookie: u.cookie, body: {} })).status).toBe(403);

    const token = linkToken(mail.text, "/verify-email")!;
    expect(await db.authToken.count({ where: { tokenHash: token } })).toBe(0); // only hashes stored
    expect((await call(verifyEmail, "/api/auth/verify-email", { body: { token } })).status).toBe(200);
    expect((await call(verifyEmail, "/api/auth/verify-email", { body: { token } })).status).toBe(400); // single use
    expect((await call(listAccounts, "/api/accounts", { cookie: u.cookie })).status).toBe(200);
  });

  it("can resend the link, and the previous link stops working", async () => {
    const u = await newUser(register, "Rhea", { verified: false });
    const first = linkToken(lastMailTo(u.email).text, "/verify-email")!;
    expect((await call(resend, "/api/auth/resend-verification", { cookie: u.cookie, body: {} })).status).toBe(200);
    const second = linkToken(lastMailTo(u.email).text, "/verify-email")!;
    expect(second).not.toBe(first);
    expect((await call(verifyEmail, "/api/auth/verify-email", { body: { token: first } })).status).toBe(400);
    expect((await call(verifyEmail, "/api/auth/verify-email", { body: { token: second } })).status).toBe(200);
  });

  it("rejects expired links", async () => {
    const u = await newUser(register, "Exp", { verified: false });
    const token = linkToken(lastMailTo(u.email).text, "/verify-email")!;
    await db.authToken.updateMany({ where: { user: { email: u.email } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(verifyEmail, "/api/auth/verify-email", { body: { token } })).status).toBe(400);
  });
});

describe("password reset", () => {
  it("resets via the emailed link, signs out everywhere and never reveals unknown emails", async () => {
    const u = await newUser(register, "Remy");
    const before = outbox.length;
    expect((await call(forgot, "/api/auth/forgot-password", { body: { email: "nobody-here@example.com" } })).status).toBe(200);
    expect(outbox.length).toBe(before);

    expect((await call(forgot, "/api/auth/forgot-password", { body: { email: u.email } })).status).toBe(200);
    const token = linkToken(lastMailTo(u.email).text, "/reset-password")!;
    expect((await call(reset, "/api/auth/reset-password", { body: { token, password: "password123" } })).status).toBe(422);
    expect((await call(reset, "/api/auth/reset-password", { body: { token, password: "a brand new passphrase" } })).status).toBe(200);
    expect((await call(reset, "/api/auth/reset-password", { body: { token, password: "another new passphrase" } })).status).toBe(400);
    expect((await call(listAccounts, "/api/accounts", { cookie: u.cookie })).status).toBe(401);
    expect((await call(login, "/api/auth/login", { body: { email: u.email, password: "correct horse battery" } })).status).toBe(401);
    expect((await call(login, "/api/auth/login", { body: { email: u.email, password: "a brand new passphrase" } })).status).toBe(200);
    expect(lastMailTo(u.email).subject).toMatch(/security alert/i);
  });
});

describe("account lockout", () => {
  it("locks after repeated failures, even with the right password, and alerts the owner", async () => {
    const u = await newUser(register, "Lock");
    for (let i = 0; i < 10; i++) {
      await resetRateLimits(); // isolate lockout from rate limiting
      await call(login, "/api/auth/login", { body: { email: u.email, password: "wrong password!!" } });
    }
    const r = await call(login, "/api/auth/login", { body: { email: u.email, password: "correct horse battery" } });
    expect(r.status).toBe(423);
    expect(lastMailTo(u.email).subject).toMatch(/locked/i);
    await db.user.update({ where: { email: u.email }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await call(login, "/api/auth/login", { body: { email: u.email, password: "correct horse battery" } })).status).toBe(200);
  });
});

describe("two-factor sign-in", () => {
  async function enable(cookie: string) {
    const s = await call(mfaSetup, "/api/settings/mfa", { cookie, body: {} });
    expect(s.json.qrSvg).toContain("<svg");
    const secret: string = s.json.secret;
    expect((await call(mfaEnable, "/api/settings/mfa/enable", { cookie, body: { code: "000000" } })).status).toBe(400);
    const e = await call(mfaEnable, "/api/settings/mfa/enable", { cookie, body: { code: totpAt(secret, currentStep()) } });
    expect(e.status).toBe(200);
    expect(e.json.recoveryCodes).toHaveLength(10);
    return { secret, codes: e.json.recoveryCodes as string[] };
  }

  it("requires a fresh code after the password, rejects replays, and accepts a backup code once", async () => {
    const u = await newUser(register, "Mia");
    const { secret, codes } = await enable(u.cookie);
    const stored = await db.user.findUniqueOrThrow({ where: { email: u.email } });
    expect(stored.mfaSecretEnc).not.toContain(secret);

    const step1 = await call(login, "/api/auth/login", { body: { email: u.email, password: "correct horse battery" } });
    expect(step1.json.mfaRequired).toBe(true);
    expect(step1.headers.get("set-cookie")).not.toMatch(/vx_session=/);
    const challenge = step1.headers.get("set-cookie")!.split(";")[0];
    expect((await call(loginMfa, "/api/auth/login/mfa", { cookie: challenge, body: { code: "123456" } })).status).toBe(401);
    // The code used to enable 2FA in this time-step can't be replayed.
    expect((await call(loginMfa, "/api/auth/login/mfa", { cookie: challenge, body: { code: totpAt(secret, currentStep()) } })).status).toBe(401);
    const ok = await call(loginMfa, "/api/auth/login/mfa", { cookie: challenge, body: { code: codes[0] } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/vx_session=/);

    const again = await call(login, "/api/auth/login", { body: { email: u.email, password: "correct horse battery" } });
    const c2 = again.headers.get("set-cookie")!.split(";")[0];
    expect((await call(loginMfa, "/api/auth/login/mfa", { cookie: c2, body: { code: codes[0] } })).status).toBe(401); // backup codes are single-use
  });

  it("locks the challenge after too many wrong codes", async () => {
    const u = await newUser(register, "Max");
    await enable(u.cookie);
    const step1 = await call(login, "/api/auth/login", { body: { email: u.email, password: "correct horse battery" } });
    const challenge = step1.headers.get("set-cookie")!.split(";")[0];
    for (let i = 0; i < 5; i++) await call(loginMfa, "/api/auth/login/mfa", { cookie: challenge, body: { code: "111111" } });
    const r = await call(loginMfa, "/api/auth/login/mfa", { cookie: challenge, body: { code: "111111" } });
    expect(r.json.error.message).toMatch(/password again/);
  });

  it("can be turned off with password and a code", async () => {
    const u = await newUser(register, "Off");
    const { codes } = await enable(u.cookie);
    expect((await call(mfaDisable, "/api/settings/mfa/disable", { cookie: u.cookie, body: { password: "wrong", code: codes[1] } })).status).toBe(400);
    expect((await call(mfaDisable, "/api/settings/mfa/disable", { cookie: u.cookie, body: { password: "correct horse battery", code: codes[1] } })).status).toBe(200);
    const r = await call(login, "/api/auth/login", { body: { email: u.email, password: "correct horse battery" } });
    expect(r.json.mfaRequired).toBe(false);
  });
});
