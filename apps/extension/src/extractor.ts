/**
 * Injected into the active tab only when the user opens the VELTRIX popup.
 * Returns a minimal, sanitized summary of public page metadata. It does not read
 * form fields, cookies or storage, and does not execute page-provided code.
 */
import { extractPage } from "@veltrix/shared/extract";

declare global {
  // eslint-disable-next-line no-var
  var __veltrixOptions: { includeArticleExcerpt?: boolean } | undefined;
}

export function run() {
  const opts = globalThis.__veltrixOptions ?? {};
  globalThis.__veltrixOptions = undefined;
  return extractPage(document, location.href, { includeArticleExcerpt: !!opts.includeArticleExcerpt });
}
