import { categoryPalette, CHART_GROUPS } from "@veltrix/shared";

/** Fixed color per spending group (color follows the entity, never its rank). */
export const groupColor = (g: string) => categoryPalette[Math.max(0, CHART_GROUPS.indexOf(g as (typeof CHART_GROUPS)[number]))] ?? categoryPalette[7];
