import { z } from "zod";
import { handler } from "@/server/http";
import { performance } from "@/server/services/investments";
import { userContext } from "@/server/services/users";

export const GET = handler({ query: z.object({ range: z.enum(["1M", "3M", "6M", "1Y", "5Y"]).default("1Y") }) }, async ({ auth, query }) =>
  performance(auth.userId, query.range, (await userContext(auth.userId)).timezone),
);
