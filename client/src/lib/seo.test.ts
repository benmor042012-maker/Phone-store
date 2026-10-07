/**
 * Structured data has to be valid, not just present.
 *
 * Search Console reported two invalid product snippets on the home page: the store record
 * listed "אייפון" and "אביזרים" as `Product` nodes with nothing but a name and a URL, and
 * Google needs a price, a rating or a review before it will call something a product. The
 * guard below walks everything these builders emit, so a bare product cannot come back.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STATIC_PAGES } from "@shared/pages";
import { buildFaqJsonLd, buildLandingBreadcrumbJsonLd, buildProductJsonLd, buildServiceJsonLd, buildStoreJsonLd } from "./seo";

/** Every `Product` node anywhere inside a record, with the path that reached it. */
function productNodes(value: unknown, at = ""): { path: string; node: Record<string, unknown> }[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => productNodes(item, `${at}[${index}]`));
  const node = value as Record<string, unknown>;
  const here = node["@type"] === "Product" ? [{ path: at || "root", node }] : [];
  return [...here, ...Object.entries(node).flatMap(([key, child]) => productNodes(child, `${at}.${key}`))];
}

/** What Google requires before a Product node is eligible rather than invalid. */
function isValidProduct(node: Record<string, unknown>) {
  return Boolean(node.offers || node.review || node.aggregateRating);
}

const origin = "https://phonestore.co.il";

describe("the store record", () => {
  const store = buildStoreJsonLd(origin) as Record<string, unknown>;

  it("never claims a product it cannot price", () => {
    for (const { path: at, node } of productNodes(store)) {
      expect(isValidProduct(node), `${at}: ${JSON.stringify(node)}`).toBe(true);
    }
  });

  it("offers the shop's services, each pointing at the page that describes it", () => {
    const catalog = store.hasOfferCatalog as { itemListElement: { itemOffered: Record<string, string> }[] };
    expect(catalog.itemListElement.length).toBeGreaterThan(0);
    for (const offer of catalog.itemListElement) {
      expect(offer.itemOffered["@type"]).toBe("Service");
      expect(offer.itemOffered.url.startsWith(`${origin}/`)).toBe(true);
      expect(offer.itemOffered.serviceType.length).toBeGreaterThan(3);
    }
  });

  it("names the shop, where it is and how to reach it", () => {
    expect(store.name).toBe("Phone Store");
    expect(store.telephone).toBe("050-477-7470");
    expect((store.address as Record<string, string>).addressLocality).toBe("נתניה");
    expect(store.foundingDate).toBe("2010");
  });
});

describe("a product's own record", () => {
  it("carries the offer that makes it a product", () => {
    const product = buildProductJsonLd(origin, { id: "1", name: "כיסוי", brand: "GRIPCASE", category: "כיסויים", price: 149, image: "/x.webp", description: "תיאור" });
    for (const { node } of productNodes(product)) expect(isValidProduct(node)).toBe(true);
    expect((product.offers as Record<string, unknown>).price).toBe(149);
  });
});

describe("the other records a page carries", () => {
  it("emits a service only for a page that describes one", () => {
    const repairs = STATIC_PAGES.find((page) => page.path === "/repairs/screen")!;
    const about = STATIC_PAGES.find((page) => page.path === "/about")!;
    expect(buildServiceJsonLd(origin, repairs)?.["@type"]).toBe("Service");
    expect(buildServiceJsonLd(origin, about)).toBeNull();
  });

  it("gives a sub-page the full trail and every record a Product-free shape", () => {
    const page = STATIC_PAGES.find((p) => p.path === "/repairs/battery")!;
    const crumbs = buildLandingBreadcrumbJsonLd(origin, page);
    expect(crumbs.itemListElement).toHaveLength(3);
    for (const record of [crumbs, buildFaqJsonLd(), buildServiceJsonLd(origin, page)]) {
      for (const { node } of productNodes(record)) expect(isValidProduct(node)).toBe(true);
    }
  });
});

describe("the document the server ships", () => {
  const indexHtml = readFileSync(path.resolve(import.meta.dirname, "..", "..", "index.html"), "utf8");

  it("carries no product snippet Google would call invalid", () => {
    const blocks = [...indexHtml.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      const parsed = JSON.parse(block);
      for (const { path: at, node } of productNodes(parsed)) {
        expect(isValidProduct(node), `${at}: ${JSON.stringify(node)}`).toBe(true);
      }
    }
  });
});
