/** Text shared by the server's cards and the client's document title, so they never drift. */

/**
 * Trims `text` to `limit` characters on a word boundary. A catalogue name runs far longer
 * than a search result or a WhatsApp card will show, and cutting mid-word reads as broken.
 */
export function clampText(text: string, limit: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  const cut = collapsed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** How long a document title may be before a search result cuts it. */
export const TITLE_LIMIT = 68;

/**
 * A product's document title: the name, trimmed only as far as it must be so the shop's
 * name and city survive the cut. A result that ends "…" without the brand tells a searcher
 * nothing about who is selling it.
 */
export function productTitle(name: string, suffix: string): string {
  return `${clampText(name, Math.max(24, TITLE_LIMIT - suffix.length))}${suffix}`;
}
