import { describe, expect, it } from "vitest";
import { buildOrderMessage, buildProductShareText, CART_STORAGE_KEY, navigationCopy, paymentMethodLabel, readStoredList, socialLinks, STORE, whatsappOrderUrl, writeStoredList } from "./storefrontState";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("storefront client state", () => {
  it("restores only valid cart records and ignores malformed local values", () => {
    const storage = memoryStorage({ [CART_STORAGE_KEY]: JSON.stringify([{ id: "1", name: "Phone" }, { id: 7 }]) });
    const isProduct = (value: unknown): value is { id: string; name: string } => Boolean(value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string" && typeof (value as { name?: unknown }).name === "string");
    expect(readStoredList(storage, CART_STORAGE_KEY, isProduct)).toEqual([{ id: "1", name: "Phone" }]);
    storage.setItem(CART_STORAGE_KEY, "not-json");
    expect(readStoredList(storage, CART_STORAGE_KEY, isProduct)).toEqual([]);
  });

  it("persists a cart, changes header language, and builds a shareable product message", () => {
    const storage = memoryStorage();
    writeStoredList(storage, CART_STORAGE_KEY, [{ id: "1" }]);
    expect(storage.getItem(CART_STORAGE_KEY)).toBe('[{"id":"1"}]');
    expect(navigationCopy.en.inventory).toBe("Inventory");
    expect(buildProductShareText("iPhone", "₪4,900", "https://example.test/products/1")).toContain("https://example.test/products/1");
  });
});

describe("WhatsApp order with Bit and PayBox", () => {
  const lines = [{ name: "iPhone 18 Pro Max", price: "₪5,400" }, { name: "כיסוי סיליקון", price: "₪139" }];

  it("asks for a Bit payment request to the store phone number", () => {
    const message = buildOrderMessage(lines, "₪5,539", "bit", "050-477-7470");
    expect(message).toContain("iPhone 18 Pro Max — ₪5,400");
    expect(message).toContain("סה״כ: ₪5,539");
    expect(message).toContain(paymentMethodLabel("bit"));
    expect(message).toContain("050-477-7470");
  });

  it("names PayBox and leaves in-store methods without a transfer request", () => {
    expect(buildOrderMessage(lines, "₪5,539", "paybox")).toContain("פייבוקס");
    const credit = buildOrderMessage(lines, "₪5,539", "credit");
    expect(credit).toContain("אשראי");
    expect(credit).not.toContain("בקשת תשלום");
  });

  it("encodes the order into the store WhatsApp link", () => {
    const url = whatsappOrderUrl(buildOrderMessage(lines, "₪5,539", "bit"), STORE.whatsapp);
    expect(url.startsWith(`https://wa.me/${STORE.whatsapp}?text=`)).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toContain("סה״כ: ₪5,539");
  });
});

describe("social channels", () => {
  it("exposes every channel over https so they can be reused as schema.org sameAs entries", () => {
    expect(socialLinks.length).toBeGreaterThanOrEqual(4);
    expect(socialLinks.every((link) => link.href.startsWith("https://"))).toBe(true);
    expect(socialLinks.map((link) => link.id)).toContain("instagram");
  });
});
