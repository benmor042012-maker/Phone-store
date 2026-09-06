/** Sitemap for the storefront: the home page plus one entry per product in the shipped catalog. */

export type SitemapProduct = { id: string; image?: string };
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
    seen.add(product.id);
    return true;
  });
  const entries = [
    `  <url>\n    <loc>${base}/</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    ...products.map((product) => {
      const loc = `${base}/products/${encodeURIComponent(product.id)}`;
      const image = product.image ? (product.image.startsWith("http") ? product.image : `${base}${product.image}`) : undefined;
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n${image ? `    <image:image>\n      <image:loc>${escapeXml(image)}</image:loc>\n    </image:image>\n` : ""}  </url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join("\n")}\n</urlset>\n`;
}
