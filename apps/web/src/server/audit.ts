import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { ipHash } from "./auth/crypto";

export type AuditType =
  | "auth.register"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_changed"
  | "auth.account_deleted"
  | "auth.email_verified"
  | "auth.password_reset_requested"
  | "auth.password_reset"
  | "auth.account_locked"
  | "auth.mfa_enabled"
  | "auth.mfa_disabled"
  | "auth.mfa_recovery_regenerated"
  | "auth.mfa_failed"
  | "bank.connected"
  | "bank.removed"
  | "session.revoked"
  | "extension.pairing_code_created"
  | "extension.paired"
  | "extension.pair_failed"
  | "extension.token_revoked"
  | "data.exported"
  | "data.demo_loaded"
  | "data.demo_removed"
  | "data.csv_imported"
  | "data.source_deleted"
  | "advisor.change_dismissed"
  | "privacy.permission_changed"
  | "privacy.notifications_changed"
  | "setup.completed"
  | "advisor.change_applied"
  | "memory.saved"
  | "memory.deleted"
  | "workflow.started"
  | "workflow.action_reported"
  | "workflow.outcome_confirmed"
  | "consent.changed"
  | "security.rate_limited"
  | "security.origin_rejected";

export async function audit(type: AuditType, opts: { userId?: string | null; ip?: string | null; userAgent?: string | null; metadata?: Prisma.InputJsonValue } = {}) {
  try {
    await db.auditEvent.create({
      data: { type, userId: opts.userId ?? null, ipHash: ipHash(opts.ip ?? null), userAgent: opts.userAgent?.slice(0, 200) ?? null, metadata: opts.metadata },
    });
  } catch {
    // Audit logging must never break the request it describes.
  }
}
