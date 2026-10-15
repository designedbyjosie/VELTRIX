import { z } from "zod";
import { handler } from "@/server/http";
import { activityHistory } from "@/server/services/privacy";

const query = z.object({ group: z.enum(["security", "connections", "data", "advisor", "privacy"]).optional(), cursor: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(100).optional() });
export const GET = handler({ query }, async ({ auth, query }) => activityHistory(auth.userId, query));
