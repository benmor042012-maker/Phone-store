import { describe, expect, it } from "vitest";
import { STATIC_PAGES } from "../shared/pages";
import { buildSitemapXml } from "./sitemap";

/** A catalogued device, which is what the sitemap offers. */
const device = (id: string, image?: string) => ({ id, image, category: "טלפונים סלולריים" });

describe("buildSitemapXml", () => {
  it("lists the home page and every device with its image, without fragment anchors", () => {
    const xml = buildSitemapXml("https://example.test/", {
      capturedAt: "2026-08-21T09:51:17.911Z",
      products: [device("33767", "/images/catalog/a.webp"), device("phone 1"), device("33767"), device("")],
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
    const xml = buildSitemapXml("https://example.test", { capturedAt: "not a date", products: [device("a&b")] });
    expect(xml).toContain("<loc>https://example.test/products/a%26b</loc>");
    // A bad capture date leaves the home page and the products undated, as before. The
    // landing pages keep their own dates, which never came from the catalogue.
    const entries = xml.split("<url>");
    expect(entries.find((part) => part.includes("<loc>https://example.test/</loc>"))).not.toContain("<lastmod>");
    expect(entries.find((part) => part.includes("/products/a%26b"))).not.toContain("<lastmod>");
    expect(buildSitemapXml("https://example.test", {})).toContain("<loc>https://example.test/</loc>");
  });
});

/**
 * The shop's ~1,800 accessories are served and linked like any other product; they are
 * simply not offered to a crawler, because submitting them spent the crawl budget that
 * the landing pages need. These guard that decision, which is otherwise invisible.
 */
describe("what is offered to a crawler", () => {
  const mixed = {
    capturedAt: "2026-08-21T09:51:17.911Z",
    products: [
      device("iphone-17"),
      { id: "tablet-1", category: "טאבלטים" },
      { id: "case-1", category: "כיסויים" },
      { id: "screen-1", category: "מגני מסך" },
      { id: "charger-1", category: "מטענים וטעינה" },
      { id: "nocat-1" },
    ],
  };

  it("lists devices and tablets", () => {
    const xml = buildSitemapXml("https://example.test", mixed);
    expect(xml).toContain("<loc>https://example.test/products/iphone-17</loc>");
    expect(xml).toContain("<loc>https://example.test/products/tablet-1</loc>");
  });

  it("leaves accessories out, however many there are", () => {
    const xml = buildSitemapXml("https://example.test", mixed);
    for (const id of ["case-1", "screen-1", "charger-1", "nocat-1"]) {
      expect(xml, id).not.toContain(`/products/${id}`);
    }
    expect(xml.match(/<url>/g)).toHaveLength(1 + STATIC_PAGES.length + 2);
  });

  it("keeps every landing page, which is the point of making room", () => {
    const xml = buildSitemapXml("https://example.test", mixed);
    for (const page of STATIC_PAGES) {
      expect(xml, page.path).toContain(`<loc>https://example.test${page.path}</loc>`);
    }
  });

  it("ranks the home page above the landing pages, and those above a device", () => {
    const xml = buildSitemapXml("https://example.test", mixed);
    const priority = (loc: string) =>
      /<priority>([\d.]+)<\/priority>/.exec(xml.split("<url>").find((part) => part.includes(`<loc>${loc}</loc>`)) ?? "")?.[1];
    expect(priority("https://example.test/")).toBe("1.0");
    expect(priority("https://example.test/repairs")).toBe("0.8");
    expect(priority("https://example.test/products/iphone-17")).toBe("0.6");
  });
});

describe("lastmod", () => {
  it("dates a landing page by its own change, not by the catalogue's capture", () => {
    const xml = buildSitemapXml("https://example.test", { capturedAt: "2026-08-21T09:51:17.911Z", products: [device("33767")] });
    for (const page of STATIC_PAGES) {
      const entry = xml.split("<url>").find((part) => part.includes(`<loc>https://example.test${page.path}</loc>`));
      expect(entry, page.path).toBeDefined();
      expect(entry, page.path).toContain(`<lastmod>${page.updated}</lastmod>`);
    }
  });

  it("still dates the home page and a product by the catalogue, which is what they show", () => {
    const xml = buildSitemapXml("https://example.test", { capturedAt: "2026-08-21T09:51:17.911Z", products: [device("33767")] });
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
