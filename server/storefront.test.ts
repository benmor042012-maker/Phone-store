/** Tests for shaping the published content envelope into what the storefront renders. */
import { describe, expect, it } from "vitest";
import { normalizeStorefrontPayload, sourceAssetUrl } from "./storefront";

describe("normalizeStorefrontPayload", () => {
  it("keeps catalog content and does not create reviews that were not supplied", () => {
    const data = normalizeStorefrontPayload({
      updatedAt: "2026-08-19T00:00:00.000Z",
      data: { settings: { name: "Phone Store", ship: 299, pay36: 36 }, categories: [{ id: "c1", name: "טלפונים" }], products: [{ id: "p1", name: "Phone", brand: "Apple", cat: "c1", price: 100, specs: { מסך: "6.1" } }], slides: [{ id: "s1", title: "כותרת", accent: "הדגשה", lead: "טקסט" }], reviews: [{ text: "ignored" }] },
    });
    expect(data.products).toHaveLength(1);
    expect(data.products[0]).toMatchObject({ id: "p1", price: 100, specs: { מסך: "6.1" } });
    expect(data.reviews).toEqual([]);
  });

  it("reads the categories the admin panel writes, which it stores under `cats`", () => {
    const envelope = { data: { settings: {}, cats: [{ id: "c1", name: "כיסויים", icon: "case" }], products: [], slides: [], reviews: [] } };
    expect(normalizeStorefrontPayload(envelope).categories).toEqual([{ id: "c1", name: "כיסויים", icon: "case", img: null }]);
  });

  it("still reads an older export that spells them `categories`", () => {
    const envelope = { data: { settings: {}, categories: [{ id: "c2", name: "מטענים", icon: "plug" }], products: [], slides: [], reviews: [] } };
    expect(normalizeStorefrontPayload(envelope).categories).toEqual([{ id: "c2", name: "מטענים", icon: "plug", img: null }]);
  });
});

describe("sourceAssetUrl", () => {
  it("resolves stored image paths against this site, not a second worker", () => {
    expect(sourceAssetUrl("img/abc123", "fallback.webp")).toBe("/img/abc123");
    expect(sourceAssetUrl("/assets/products/p1.webp", "fallback.webp")).toBe("/assets/products/p1.webp");
  });

  it("leaves an absolute URL alone and falls back when there is no path", () => {
    expect(sourceAssetUrl("https://cdn.example/p1.webp", "fallback.webp")).toBe("https://cdn.example/p1.webp");
    expect(sourceAssetUrl(null, "fallback.webp")).toBe("fallback.webp");
  });
});
