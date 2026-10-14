import { z } from "zod";
import { productSaveSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { listProducts, saveProduct } from "@/server/services/shopping";

export const GET = handler({ auth: "session-or-token", scope: "extension", query: z.object({ status: z.enum(["WISHLIST", "WATCHING", "PURCHASED", "ARCHIVED"]).optional() }) }, async ({ auth, query }) => ({
  products: await listProducts(auth.userId, query.status),
}));
export const POST = handler({ body: productSaveSchema }, async ({ auth, body }) => ({ product: await saveProduct(auth.userId, { ...body, source: "MANUAL" }, "MANUAL") }));
