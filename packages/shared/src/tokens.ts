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
 * Validated for the dark surface with the dataviz palette validator.
 */
export const categoryPalette = [
  "#2878FF", // housing
  "#FF9F43", // food
  "#A47BFF", // shopping
  "#39D9FF", // transport
  "#F062C0", // travel
  "#26D9A0", // entertainment
  "#E8D44D", // utilities
  "#6F86A8", // other
] as const;

export type ColorToken = keyof typeof colors;
