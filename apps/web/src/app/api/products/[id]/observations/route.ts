import { priceObservationSchema, toCents } from "@veltrix/shared";
import { handler } from "@/server/http";
import { getProduct, recordObservation } from "@/server/services/shopping";

type P = { id: string };
export const POST = handler<typeof priceObservationSchema._output, undefined, P>({ body: priceObservationSchema }, async ({ auth, body, params }) => {
  const p = await getProduct(auth.userId, params.id);
  await recordObservation(auth.userId, p.id, {
    priceCents: toCents(body.price),
    currency: body.currency,
    merchant: p.merchant,
    sourceUrl: p.url,
    shippingCents: body.shippingCost ? toCents(body.shippingCost) : null,
    source: "MANUAL",
    observedAt: body.observedAt ? new Date(body.observedAt) : undefined,
  });
  return { product: await getProduct(auth.userId, p.id) };
});
