/**
 * Account security flows: email verification, password reset, failed-login lockout
 * and two-factor sign-in (TOTP + one-time recovery codes).
 * Every emailed token and recovery code is stored only as a SHA-256 hash.
 */
import QRCode from "qrcode";
import { db } from "../db";
import { HttpError } from "../errors";
import { randomToken, sha256 } from "../auth/crypto";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession } from "../auth/session";
import { currentStep, generateSecret, otpauthUri, verifyTotp } from "../auth/totp";
import { open, seal } from "../crypto-box";
import { sendMail } from "../mail";
import { resetPasswordMessage, securityAlertMessage, verifyEmailMessage } from "../emails";
import { audit } from "../audit";

const HOUR = 3_600_000;
export const LOCK_THRESHOLD = 10;
export const LOCK_MS = 15 * 60_000;
export const CHALLENGE_TTL_MS = 5 * 60_000;
const CHALLENGE_MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------- emailed tokens

async function issueToken(userId: string, purpose: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlMs: number) {
  await db.authToken.deleteMany({ where: { userId, purpose, usedAt: null } });
  const token = randomToken(32);
  await db.authToken.create({ data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

async function consumeToken(token: string, purpose: "EMAIL_VERIFY" | "PASSWORD_RESET") {
  const record = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date()) return null;
  const claimed = await db.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? record.userId : null;
}

/** Fire-and-report security email; failures are logged, never block the action. */
async function alert(userId: string, event: string, detail: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await sendMail(securityAlertMessage(user.email, event, detail)).catch((e) => console.error("[veltrix] security email failed", e));
}

export async function sendVerificationEmail(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });
  if (user.emailVerifiedAt) return { alreadyVerified: true };
  const token = await issueToken(userId, "EMAIL_VERIFY", 24 * HOUR);
  await sendMail(verifyEmailMessage(user.email, user.profile?.displayName ?? "there", token));
  return { alreadyVerified: false };
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) throw new HttpError(400, "invalid_token", "This confirmation link is invalid or has expired. Request a new one.");
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await audit("auth.email_verified", { userId });
  return userId;
}

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  // Same response whether or not the account exists.
  if (!user) return;
  const token = await issueToken(user.id, "PASSWORD_RESET", HOUR);
  await sendMail(resetPasswordMessage(user.email, token));
  await audit("auth.password_reset_requested", { userId: user.id });
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) throw new HttpError(400, "invalid_token", "This reset link is invalid or has expired. Request a new one.");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
  // Sign out everywhere and cancel pending sign-ins.
  await db.session.deleteMany({ where: { userId } });
  await db.loginChallenge.deleteMany({ where: { userId } });
  await audit("auth.password_reset", { userId });
  await alert(userId, "Your password was reset", "The password for your VELTRIX account was just changed using a reset link, and all devices were signed out.");
}

// ---------------------------------------------------------------- sign-in

export type LoginOutcome = { kind: "session"; token: string; userId: string } | { kind: "mfa"; challenge: string; userId: string };

export async function loginWithPassword(email: string, password: string, userAgent: string | null, ip: string | null): Promise<LoginOutcome> {
  const user = await db.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    // Still run a hash comparison so a locked account isn't distinguishable by timing.
    await verifyPassword(password, null);
    throw new HttpError(423, "account_locked", "Too many failed attempts. Try again in 15 minutes, or reset your password.");
  }
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) {
    if (user) {
      const count = user.failedLoginCount + 1;
      const lock = count >= LOCK_THRESHOLD;
      await db.user.update({ where: { id: user.id }, data: lock ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLoginCount: count } });
      if (lock) {
        await audit("auth.account_locked", { userId: user.id, ip, userAgent });
        await alert(user.id, "Sign-in temporarily locked", `There were ${LOCK_THRESHOLD} failed attempts to sign in to your account, so sign-in is paused for 15 minutes.`);
      }
    }
    await audit("auth.login_failed", { userId: user?.id ?? null, ip, userAgent });
    throw new HttpError(401, "invalid_credentials", "That email and password combination didn't match.");
  }
  if (user.failedLoginCount || user.lockedUntil) await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  if (user.mfaEnabledAt && user.mfaSecretEnc) {
    const challenge = randomToken(32);
    await db.loginChallenge.create({ data: { userId: user.id, tokenHash: sha256(challenge), expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) } });
    return { kind: "mfa", challenge, userId: user.id };
  }
  const { token } = await createSession(user.id, userAgent);
  return { kind: "session", token, userId: user.id };
}

const normalizeRecovery = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Checks a TOTP code (with replay protection) or an unused recovery code. */
async function checkSecondFactor(userId: string, code: string): Promise<"totp" | "recovery" | null> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaSecretEnc) return null;
  const step = verifyTotp(open(user.mfaSecretEnc), code);
  if (step !== null) {
    if (user.mfaLastStep !== null && step <= user.mfaLastStep) return null;
    const claimed = await db.user.updateMany({ where: { id: userId, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] }, data: { mfaLastStep: step } });
    return claimed.count === 1 ? "totp" : null;
  }
  const normalized = normalizeRecovery(code);
  if (normalized.length !== 10) return null;
  const used = await db.mfaRecoveryCode.updateMany({ where: { userId, codeHash: sha256(normalized), usedAt: null }, data: { usedAt: new Date() } });
  return used.count === 1 ? "recovery" : null;
}

export async function completeMfaLogin(challenge: string, code: string, userAgent: string | null) {
  const record = await db.loginChallenge.findUnique({ where: { tokenHash: sha256(challenge) } });
  if (!record || record.expiresAt < new Date()) throw new HttpError(401, "challenge_expired", "Your sign-in timed out. Enter your password again.");
  if (record.attempts >= CHALLENGE_MAX_ATTEMPTS) {
    await db.loginChallenge.delete({ where: { id: record.id } }).catch(() => undefined);
    throw new HttpError(401, "challenge_expired", "Too many incorrect codes. Enter your password again.");
  }
  await db.loginChallenge.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
  const factor = await checkSecondFactor(record.userId, code);
  if (!factor) throw new HttpError(401, "invalid_code", "That code didn't work. Check your authenticator app and try again.");
  await db.loginChallenge.delete({ where: { id: record.id } });
  if (factor === "recovery") {
    const left = await db.mfaRecoveryCode.count({ where: { userId: record.userId, usedAt: null } });
    await alert(record.userId, "A backup code was used", `Someone signed in with one of your two-factor backup codes. You have ${left} left.`);
  }
  const { token } = await createSession(record.userId, userAgent);
  return { token, userId: record.userId, factor };
}

// ---------------------------------------------------------------- two-factor management

export async function mfaStatus(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const remaining = await db.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
  return { enabled: !!user.mfaEnabledAt, enabledAt: user.mfaEnabledAt?.toISOString() ?? null, recoveryCodesRemaining: remaining };
}

export async function beginMfaSetup(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.mfaEnabledAt) throw new HttpError(409, "conflict", "Two-factor sign-in is already on.");
  const secret = generateSecret();
  await db.user.update({ where: { id: userId }, data: { mfaPendingEnc: seal(secret) } });
  const uri = otpauthUri(secret, user.email);
  return { secret, uri, qrSvg: await QRCode.toString(uri, { type: "svg", margin: 1, color: { dark: "#050B18", light: "#FFFFFF" } }) };
}

function newRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const raw = randomToken(16).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10).padEnd(10, "X");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

async function storeRecoveryCodes(userId: string) {
  const codes = newRecoveryCodes();
  await db.$transaction([db.mfaRecoveryCode.deleteMany({ where: { userId } }), db.mfaRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: sha256(normalizeRecovery(c)) })) })]);
  return codes;
}

export async function enableMfa(userId: string, code: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.mfaEnabledAt) throw new HttpError(409, "conflict", "Two-factor sign-in is already on.");
  if (!user.mfaPendingEnc) throw new HttpError(400, "no_setup", "Start setup again to get a new QR code.");
  const secret = open(user.mfaPendingEnc);
  const step = verifyTotp(secret, code);
  if (step === null) throw new HttpError(400, "invalid_code", "That code didn't match. Make sure your phone's clock is set automatically and try the newest code.");
  await db.user.update({ where: { id: userId }, data: { mfaSecretEnc: user.mfaPendingEnc, mfaPendingEnc: null, mfaEnabledAt: new Date(), mfaLastStep: step } });
  const codes = await storeRecoveryCodes(userId);
  await audit("auth.mfa_enabled", { userId });
  await alert(userId, "Two-factor sign-in turned on", "Your VELTRIX account now asks for a code from your authenticator app when you sign in.");
  return { recoveryCodes: codes };
}

export async function disableMfa(userId: string, password: string, code: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaEnabledAt) throw new HttpError(409, "conflict", "Two-factor sign-in is already off.");
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(400, "invalid_password", "Your password is incorrect.");
  if (!(await checkSecondFactor(userId, code))) throw new HttpError(400, "invalid_code", "That code didn't work.");
  await db.user.update({ where: { id: userId }, data: { mfaSecretEnc: null, mfaPendingEnc: null, mfaEnabledAt: null, mfaLastStep: null } });
  await db.mfaRecoveryCode.deleteMany({ where: { userId } });
  await audit("auth.mfa_disabled", { userId });
  await alert(userId, "Two-factor sign-in turned off", "Your VELTRIX account no longer asks for an authenticator code when you sign in.");
}

export async function regenerateRecoveryCodes(userId: string, password: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaEnabledAt) throw new HttpError(409, "conflict", "Turn on two-factor sign-in first.");
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(400, "invalid_password", "Your password is incorrect.");
  const codes = await storeRecoveryCodes(userId);
  await audit("auth.mfa_recovery_regenerated", { userId });
  return { recoveryCodes: codes };
}

export { currentStep, alert as sendSecurityAlert };
