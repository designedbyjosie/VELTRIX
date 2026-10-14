/**
 * Home dashboard widgets. A user's layout is an ordered list of the widgets they
 * want to see; anything missing is hidden.
 */
export const DASHBOARD_WIDGETS = [
  { id: "metrics", label: "Summary cards", description: "Net worth, monthly spending, savings and investments", size: "full" },
  { id: "plan", label: "Monthly plan", description: "Income, budgeted spending, goal saving and what's left", size: "full" },
  { id: "spending", label: "Spending breakdown", description: "Where your money went this month", size: "half" },
  { id: "performance", label: "Investment performance", description: "Portfolio value over time", size: "half" },
  { id: "budget", label: "Budget progress", description: "This month's budget categories", size: "half" },
  { id: "goals", label: "Goals", description: "Progress toward your savings goals", size: "half" },
  { id: "recommendations", label: "Top opportunities", description: "Connected findings worth reviewing", size: "full" },
] as const;

export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number]["id"];
export const DASHBOARD_WIDGET_IDS = DASHBOARD_WIDGETS.map((w) => w.id) as [DashboardWidget, ...DashboardWidget[]];
export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidget[] = ["metrics", "plan", "spending", "performance", "budget", "goals", "recommendations"];

export function widgetLabel(id: string): string {
  return DASHBOARD_WIDGETS.find((w) => w.id === id)?.label ?? id;
}

/** Stored JSON → a clean ordered list of known, unique widgets (default when unset). */
export function normalizeLayout(raw: unknown): DashboardWidget[] {
  if (!Array.isArray(raw)) return [...DEFAULT_DASHBOARD_LAYOUT];
  const out: DashboardWidget[] = [];
  for (const v of raw) if ((DASHBOARD_WIDGET_IDS as string[]).includes(v) && !out.includes(v)) out.push(v);
  return out;
}

/** Show or hide one widget. A newly shown widget goes to the top, the bottom, or its default slot. */
export function setWidgetVisibility(layout: DashboardWidget[], widget: DashboardWidget, visible: boolean, position?: "top" | "bottom"): DashboardWidget[] {
  const rest = layout.filter((w) => w !== widget);
  if (!visible) return rest;
  if (position === "top") return [widget, ...rest];
  if (position === "bottom") return [...rest, widget];
  if (layout.includes(widget)) return layout;
  const rank = (w: DashboardWidget) => DEFAULT_DASHBOARD_LAYOUT.indexOf(w);
  const at = rest.findIndex((w) => rank(w) > rank(widget));
  return at === -1 ? [...rest, widget] : [...rest.slice(0, at), widget, ...rest.slice(at)];
}
