import { describe, expect, it } from "vitest";
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
    expect(xml.match(/<url>/g)).toHaveLength(3);
    expect(xml).not.toContain("#");
  });

  it("escapes XML special characters and survives a malformed catalog", () => {
    const xml = buildSitemapXml("https://example.test", { capturedAt: "not a date", products: [{ id: "a&b" }] });
    expect(xml).toContain("<loc>https://example.test/products/a%26b</loc>");
    expect(xml).not.toContain("<lastmod>");
    expect(buildSitemapXml("https://example.test", {})).toContain("<loc>https://example.test/</loc>");
  });
});
