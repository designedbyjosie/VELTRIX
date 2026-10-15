/** Plain-language names and groups for audit events, shared by Settings and Privacy & Permissions. */
export const EVENT_LABELS: Record<string, string> = {
  "auth.register": "Account created",
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.logout": "Signed out",
  "auth.password_changed": "Password changed",
  "auth.email_verified": "Email confirmed",
  "auth.password_reset_requested": "Password reset requested",
  "auth.password_reset": "Password reset by email link",
  "auth.account_locked": "Sign-in locked after failed attempts",
  "auth.mfa_enabled": "Two-factor sign-in turned on",
  "auth.mfa_disabled": "Two-factor sign-in turned off",
  "auth.mfa_recovery_regenerated": "New backup codes created",
  "auth.mfa_failed": "Incorrect two-factor code",
  "bank.connected": "Bank connected",
  "bank.removed": "Bank connection removed",
  "session.revoked": "Session revoked",
  "extension.pairing_code_created": "Extension pairing code created",
  "extension.paired": "Browser extension connected",
  "extension.pair_failed": "Extension connection attempt failed",
  "extension.token_revoked": "Browser extension disconnected",
  "data.exported": "Data exported",
  "data.demo_loaded": "Demo data loaded",
  "data.demo_removed": "Demo data removed",
  "data.csv_imported": "Transactions imported",
  "data.source_deleted": "Data deleted from a source",
  "setup.completed": "Guided setup completed",
  "advisor.change_applied": "Advisor change applied",
  "advisor.change_dismissed": "Advisor change dismissed",
  "memory.saved": "Saved to financial memory",
  "memory.deleted": "Removed from financial memory",
  "workflow.started": "Savings plan started",
  "workflow.action_reported": "You reported acting on a savings plan",
  "workflow.outcome_confirmed": "Savings outcome confirmed",
  "consent.changed": "Privacy choice changed",
  "privacy.permission_changed": "Permission changed",
  "privacy.notifications_changed": "Notification settings changed",
  "security.rate_limited": "Too many requests blocked",
  "security.origin_rejected": "Cross-site request blocked",
};

export const EVENT_GROUPS = {
  security: { label: "Sign-in & security", prefixes: ["auth.", "session.", "security."] },
  connections: { label: "Connections", prefixes: ["bank.", "extension."] },
  data: { label: "Your data", prefixes: ["data.", "setup.", "memory."] },
  advisor: { label: "Advisor & plans", prefixes: ["advisor.", "workflow."] },
  privacy: { label: "Privacy choices", prefixes: ["consent.", "privacy."] },
} as const;
export type EventGroup = keyof typeof EVENT_GROUPS;

export function eventGroup(type: string): EventGroup | null {
  for (const [k, g] of Object.entries(EVENT_GROUPS)) if (g.prefixes.some((p) => type.startsWith(p))) return k as EventGroup;
  return null;
}
