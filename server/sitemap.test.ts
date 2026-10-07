import { describe, expect, it } from "vitest";
import { STATIC_PAGES } from "../shared/pages";
import { buildSitemapXml } from "./sitemap";

describe("buildSitemapXml", () => {
  it("lists the home page and every product with its image, without fragment anchors", () => {
    const xml = buildSitemapXml("https://example.test/", {
      capturedAt: "2026-08-21T09:51:17.911Z",
      products: [{ id: "33767", image: "/images/catalog/a.webp" }, { id: "phone 1" }, { id: "33767" }, { id: "" }],
    });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<loc>https://example.test/</loc>");
    expect(xml).toContain("<loc>https://example.test/products/33767</loc>");
    expect(xml).toContain("<image:loc>https://example.test/images/catalog/a.webp</image:loc>");
    expect(xml).toContain("<loc>https://example.test/products/phone%201</loc>");
    expect(xml).toContain("<lastmod>2026-08-21</lastmod>");
    expect(xml.match(/<url>/g)).toHaveLength(3 + STATIC_PAGES.length);
    expect(xml.indexOf("<loc>https://example.test/repairs</loc>")).toBeLessThan(xml.indexOf("<loc>https://example.test/products/33767</loc>"));
    expect(xml).not.toContain("#");
  });

  it("escapes XML special characters and survives a malformed catalog", () => {
    const xml = buildSitemapXml("https://example.test", { capturedAt: "not a date", products: [{ id: "a&b" }] });
    expect(xml).toContain("<loc>https://example.test/products/a%26b</loc>");
    // A bad capture date leaves the home page and the products undated, as before. The
    // landing pages keep their own dates, which never came from the catalogue.
    const entries = xml.split("<url>");
    expect(entries.find((part) => part.includes("<loc>https://example.test/</loc>"))).not.toContain("<lastmod>");
    expect(entries.find((part) => part.includes("/products/a%26b"))).not.toContain("<lastmod>");
    expect(buildSitemapXml("https://example.test", {})).toContain("<loc>https://example.test/</loc>");
  });
});

describe("lastmod", () => {
  it("dates a landing page by its own change, not by the catalogue's capture", () => {
    const xml = buildSitemapXml("https://example.test", { capturedAt: "2026-08-21T09:51:17.911Z", products: [{ id: "33767" }] });
    for (const page of STATIC_PAGES) {
      const entry = xml.split("<url>").find((part) => part.includes(`<loc>https://example.test${page.path}</loc>`));
      expect(entry, page.path).toBeDefined();
      expect(entry, page.path).toContain(`<lastmod>${page.updated}</lastmod>`);
    }
  });

  it("still dates the home page and a product by the catalogue, which is what they show", () => {
    const xml = buildSitemapXml("https://example.test", { capturedAt: "2026-08-21T09:51:17.911Z", products: [{ id: "33767" }] });
    const home = xml.split("<url>").find((part) => part.includes("<loc>https://example.test/</loc>"));
    const product = xml.split("<url>").find((part) => part.includes("/products/33767"));
    expect(home).toContain("<lastmod>2026-08-21</lastmod>");
    expect(product).toContain("<lastmod>2026-08-21</lastmod>");
  });

  it("leaves a landing page dated even when the catalogue has no date at all", () => {
    const xml = buildSitemapXml("https://example.test", { products: [] });
    expect(xml).toContain(`<loc>https://example.test/repairs</loc>`);
    expect(xml.split("<url>").find((part) => part.includes("/repairs<"))).toContain("<lastmod>");
  });
});
