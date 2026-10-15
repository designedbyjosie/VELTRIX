/** Workflow stage labels, shared by server and client components. */
export const STAGE_LABEL: Record<string, { label: string; tone: "info" | "violet" | "warn" | "pos" | "neg" | "neutral" }> = {
  prepared: { label: "Plan ready", tone: "info" },
  approved: { label: "Approved: your move", tone: "violet" },
  action_taken: { label: "Checking outcome", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "pos" },
  not_confirmed: { label: "Not confirmed", tone: "neg" },
  abandoned: { label: "Stopped", tone: "neutral" },
};
