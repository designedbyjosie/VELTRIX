import { handler } from "@/server/http";
import { listArticles } from "@/server/services/articles";

export const GET = handler({}, async ({ auth }) => ({ articles: await listArticles(auth.userId) }));
