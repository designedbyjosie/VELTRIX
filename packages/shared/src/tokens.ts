/**
 * VELTRIX design tokens. Single source of truth for the web app (mirrored as CSS
 * variables in apps/web/src/app/globals.css) and the browser extension.
 */
export const colors = {
  bg: "#050B18",
  bg2: "#091426",
  panel: "#0D1B31",
  panelHi: "#112340",
  border: "#19365A",
  borderSoft: "#132A47",
  blue: "#2878FF",
  violet: "#7954FF",
  cyan: "#39D9FF",
  positive: "#26D9A0",
  negative: "#FF647C",
  warning: "#FFB547",
  text: "#F4F7FF",
  text2: "#94A7C5",
  text3: "#647896",
} as const;

/**
 * Categorical chart palette, assigned in fixed order to spending categories.
 * Validated on the #0D1B31 panel surface (dark mode): every slot in the OKLCH
 * L 0.48–0.67 band, chroma ≥ 0.1, worst adjacent CVD ΔE 10.5. "Other" is a
 * deliberate neutral. Charts also carry legends/direct labels as secondary encoding.
 */
export const categoryPalette = [
  "#3B82F6", // housing
  "#D96A26", // food
  "#1798BD", // shopping
  "#D55181", // transport
  "#C98500", // travel
  "#8F72F0", // entertainment
  "#16A06C", // utilities
  "#5D7290", // other (neutral by design)
] as const;

export type ColorToken = keyof typeof colors;
