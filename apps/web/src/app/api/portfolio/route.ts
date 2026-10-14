import { handler } from "@/server/http";
import { checkAlerts, getPortfolio } from "@/server/services/investments";

export const GET = handler({}, async ({ auth }) => {
  await checkAlerts(auth.userId);
  return getPortfolio(auth.userId);
});
