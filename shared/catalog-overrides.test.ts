/**
 * The shop owner's changes are stored apart from the catalog and merged on read, so this
 * merge is what customers actually see. It has to survive a malformed stored record.
 */
import { describe, expect, it } from "vitest";
import { applyOverrides, EMPTY_OVERRIDES, isEmptyOverrides, normalizeAdded, normalizeEdit, normalizeOverrides, visibleCategories, type CatalogProduct } from "./catalog-overrides";

const base: CatalogProduct[] = [
  { id: "a", name: "כיסוי", brand: "GRIPCASE", category: "כיסויים", price: 149, image: "/images/catalog/a.webp", facts: [] },
  { id: "b", name: "מטען", brand: "Anker", category: "מטענים וטעינה", price: 99, image: "/images/catalog/b.webp", facts: [] },
];

describe("applyOverrides", () => {
  it("returns the catalog untouched when nothing has been changed", () => {
    expect(applyOverrides(base, EMPTY_OVERRIDES)).toEqual(base);
  });

  it("applies a price change without touching the rest of the product", () => {
    const merged = applyOverrides(base, { ...EMPTY_OVERRIDES, edits: { a: { price: 129, oldPrice: 149, badge: "מבצע" } } });
    expect(merged[0]).toMatchObject({ id: "a", name: "כיסוי", price: 129, oldPrice: 149, badge: "מבצע" });
    expect(merged[1]).toEqual(base[1]);
  });

  it("clears the sale price when the owner empties that field", () => {
    const sale = [{ ...base[0], oldPrice: 199 }, base[1]];
    const merged = applyOverrides(sale, { ...EMPTY_OVERRIDES, edits: { a: { oldPrice: 0 } } });
    expect("oldPrice" in merged[0]).toBe(false);
  });

  it("drops hidden products, including ones the owner added", () => {
    const own: CatalogProduct = { id: "own-1", name: "שלי", brand: "", category: "אביזרים", price: 10, image: "", facts: [] };
    const merged = applyOverrides(base, { hidden: ["a", "own-1"], edits: {}, added: [own] });
    expect(merged.map((product) => product.id)).toEqual(["b"]);
  });

  it("puts the owner's own products in front of the catalog", () => {
    const own: CatalogProduct = { id: "own-1", name: "שלי", brand: "", category: "אביזרים", price: 10, image: "", facts: [] };
    expect(applyOverrides(base, { ...EMPTY_OVERRIDES, added: [own] }).map((product) => product.id)).toEqual(["own-1", "a", "b"]);
  });

  it("ignores an edit for a product that is no longer in the catalog", () => {
    expect(applyOverrides(base, { ...EMPTY_OVERRIDES, edits: { gone: { price: 1 } } })).toEqual(base);
  });
});

describe("normalizeOverrides", () => {
  it("repairs a stored record rather than letting one bad field break the catalog", () => {
    const repaired = normalizeOverrides({
      hidden: ["a", "a", "", 7, null],
      edits: { a: { price: 129, nonsense: "x" }, "": { price: 1 }, b: "not an object" },
      added: [{ id: "own-1", name: "שלי", price: 10 }, { name: "no id" }, null],
    });
    expect(repaired.hidden).toEqual(["a"]);
    expect(repaired.edits).toEqual({ a: { price: 129 } });
    expect(repaired.added).toHaveLength(1);
    expect(repaired.added[0]).toMatchObject({ id: "own-1", name: "שלי", price: 10, facts: [] });
  });

  it("returns an empty set for anything that is not a record", () => {
    for (const value of [null, undefined, [], "text", 7]) {
      expect(isEmptyOverrides(normalizeOverrides(value))).toBe(true);
    }
  });

  it("refuses a negative or non-numeric price rather than storing it", () => {
    expect(normalizeEdit({ price: -5 })).toBeNull();
    expect(normalizeEdit({ price: "129" })).toBeNull();
    expect(normalizeAdded({ id: "own-1", name: "שלי", price: -1 })).toBeNull();
    expect(normalizeAdded({ id: "own-1", name: "   ", price: 10 })).toBeNull();
  });

  it("keeps only a badge the storefront knows how to render", () => {
    expect(normalizeEdit({ badge: "מבצע" })).toEqual({ badge: "מבצע" });
    expect(normalizeEdit({ badge: "SALE" })).toBeNull();
  });

  it("drops fact rows that are not a label and a value", () => {
    const product = normalizeAdded({ id: "own-1", name: "שלי", price: 10, facts: [["צבע", "שחור"], ["חסר"], ["", "ריק"], "nope"] });
    expect(product?.facts).toEqual([["צבע", "שחור"]]);
  });
});

describe("visibleCategories", () => {
  it("keeps only categories that still have a product, and adds the owner's new ones", () => {
    const own: CatalogProduct = { id: "own-1", name: "שלי", brand: "", category: "מוצרי יד שנייה", price: 10, image: "", facts: [] };
    const products = applyOverrides(base, { hidden: ["b"], edits: {}, added: [own] });
    expect(visibleCategories(products, ["כיסויים", "מטענים וטעינה"])).toEqual(["כיסויים", "מוצרי יד שנייה"]);
  });
});
