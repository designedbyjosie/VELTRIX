import { consentUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { getConsents, setConsent } from "@/server/services/users";
import { audit } from "@/server/audit";

export const GET = handler({}, async ({ auth }) => ({ consents: await getConsents(auth.userId) }));
export const POST = handler({ body: consentUpdateSchema }, async ({ auth, body, ip, userAgent }) => {
  await setConsent(auth.userId, body.purpose, body.granted);
  await audit("consent.changed", { userId: auth.userId, ip, userAgent, metadata: { purpose: body.purpose, granted: body.granted } });
  return { consents: await getConsents(auth.userId) };
});
