/**
 * Sitemap for the storefront: the home page, the landing pages, and the devices.
 *
 * Accessories are left out on purpose. They are perfectly good pages — served with their
 * own markup, linked from the catalogue, indexable — but there are ~1,800 of them and
 * 1,100 are cases that differ by a model name. Offering all of them spent a small site's
 * crawl budget on pages that cannot rank: of 1,831 URLs submitted, Google indexed 3. What
 * is listed here is what the shop is searched for.
 */
import { isIndexedCategory } from "../shared/catalog-overrides";
import { STATIC_PAGES } from "../shared/pages";

export type SitemapProduct = { id: string; image?: string; category?: string };
export type SitemapCatalog = { capturedAt?: string; products?: SitemapProduct[] };

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}

function isoDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date(NaN);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** Builds the sitemap XML. Fragment anchors are never listed because crawlers ignore them. */
export function buildSitemapXml(origin: string, catalog: SitemapCatalog): string {
  const base = origin.replace(/\/+$/, "");
  const lastmod = isoDate(catalog.capturedAt);
  const seen = new Set<string>();
  const products = (catalog.products ?? []).filter((product) => {
    if (!product || typeof product.id !== "string" || !product.id.trim() || seen.has(product.id)) return false;
    if (!isIndexedCategory(product.category)) return false;
    seen.add(product.id);
    return true;
  });
  const entries = [
    `  <url>\n    <loc>${base}/</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    // A landing page carries its own date. The catalogue's capture date belongs to the
    // inventory, and using it here claimed a page written today had not changed in months.
    ...STATIC_PAGES.map((page) => `  <url>\n    <loc>${base}${page.path}</loc>\n${page.updated ? `    <lastmod>${page.updated}</lastmod>\n` : ""}    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`),
    ...products.map((product) => {
      const loc = `${base}/products/${encodeURIComponent(product.id)}`;
      const image = product.image ? (product.image.startsWith("http") ? product.image : `${base}${product.image}`) : undefined;
      // Below the landing pages: a device page sells one item, a landing page is what the
      // shop is found by. With a short sitemap the ordering is readable again.
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n${image ? `    <image:image>\n      <image:loc>${escapeXml(image)}</image:loc>\n    </image:image>\n` : ""}  </url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join("\n")}\n</urlset>\n`;
}
