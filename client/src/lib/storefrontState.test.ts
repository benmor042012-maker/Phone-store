import { describe, expect, it } from "vitest";
import { buildProductShareText, CART_STORAGE_KEY, navigationCopy, readStoredList, writeStoredList } from "./storefrontState";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("storefront client state", () => {
  it("restores only valid cart records and ignores malformed local values", () => {
    const storage = memoryStorage({ [CART_STORAGE_KEY]: JSON.stringify([{ id: 1, name: "Phone" }, { id: "bad" }]) });
    const isProduct = (value: unknown): value is { id: number; name: string } => Boolean(value && typeof value === "object" && typeof (value as { id?: unknown }).id === "number" && typeof (value as { name?: unknown }).name === "string");
    expect(readStoredList(storage, CART_STORAGE_KEY, isProduct)).toEqual([{ id: 1, name: "Phone" }]);
    storage.setItem(CART_STORAGE_KEY, "not-json");
    expect(readStoredList(storage, CART_STORAGE_KEY, isProduct)).toEqual([]);
  });

  it("persists a cart, changes header language, and builds a shareable product message", () => {
    const storage = memoryStorage();
    writeStoredList(storage, CART_STORAGE_KEY, [{ id: 1 }]);
    expect(storage.getItem(CART_STORAGE_KEY)).toBe('[{"id":1}]');
    expect(navigationCopy.en.inventory).toBe("Inventory");
    expect(buildProductShareText("iPhone", "₪4,900", "https://example.test/products/1")).toContain("https://example.test/products/1");
  });
});
