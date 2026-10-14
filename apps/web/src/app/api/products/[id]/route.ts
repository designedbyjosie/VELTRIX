import { productUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteProduct, getProduct, updateProduct } from "@/server/services/shopping";

type P = { id: string };
export const GET = handler<undefined, undefined, P>({}, async ({ auth, params }) => ({ product: await getProduct(auth.userId, params.id) }));
export const PATCH = handler<typeof productUpdateSchema._output, undefined, P>({ body: productUpdateSchema }, async ({ auth, body, params }) => ({ product: await updateProduct(auth.userId, params.id, body) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteProduct(auth.userId, params.id);
  return { ok: true };
});
