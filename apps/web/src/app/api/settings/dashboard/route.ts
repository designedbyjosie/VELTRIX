import { dashboardLayoutSchema, normalizeLayout } from "@veltrix/shared";
import { handler } from "@/server/http";
import { db } from "@/server/db";

export const GET = handler({}, async ({ auth }) => {
  const p = await db.userProfile.findUnique({ where: { userId: auth.userId }, select: { dashboardLayout: true } });
  return { layout: normalizeLayout(p?.dashboardLayout) };
});

export const PATCH = handler({ body: dashboardLayoutSchema }, async ({ auth, body }) => {
  const layout = normalizeLayout(body.layout);
  await db.userProfile.update({ where: { userId: auth.userId }, data: { dashboardLayout: layout } });
  return { layout };
});
