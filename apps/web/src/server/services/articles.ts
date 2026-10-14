import { canonicalizeUrl } from "@veltrix/shared";
import { db } from "../db";
import { badRequest, notFound } from "../errors";

export async function saveArticle(
  userId: string,
  a: { title: string; url: string; publisher: string | null; publishedAt: string | null; summary: string | null; summarySource: string; symbols: string[]; source?: "EXTENSION" | "MANUAL" | "DEMO" },
) {
  const canonicalUrl = canonicalizeUrl(a.url);
  if (!canonicalUrl) throw badRequest("Only http(s) articles can be saved.");
  return db.savedArticle.upsert({
    where: { userId_canonicalUrl: { userId, canonicalUrl } },
    create: {
      userId,
      title: a.title,
      url: a.url,
      canonicalUrl,
      publisher: a.publisher,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
      summary: a.summary,
      summarySource: a.summarySource,
      mentionedSymbols: a.symbols,
      source: a.source ?? "EXTENSION",
    },
    update: { title: a.title, ...(a.summary ? { summary: a.summary, summarySource: a.summarySource } : {}), mentionedSymbols: a.symbols },
  });
}

export async function listArticles(userId: string, limit = 50) {
  const rows = await db.savedArticle.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    publisher: r.publisher,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    summary: r.summary,
    summarySource: r.summarySource,
    symbols: r.mentionedSymbols,
    source: r.source,
    savedAt: r.createdAt.toISOString(),
  }));
}

export async function deleteArticle(userId: string, id: string) {
  const a = await db.savedArticle.findFirst({ where: { id, userId } });
  if (!a) throw notFound("Article");
  await db.savedArticle.delete({ where: { id } });
}
