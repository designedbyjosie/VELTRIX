import { handler } from "@/server/http";
import { listCategories } from "@/server/services/categories";

export const GET = handler({}, async ({ auth }) => ({ categories: await listCategories(auth.userId) }));
