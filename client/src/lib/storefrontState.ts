export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const CART_STORAGE_KEY = "phone-store.cart";
export const SAVED_STORAGE_KEY = "phone-store.saved";

export function readStoredList<T>(storage: StorageLike, key: string, isValid: (value: unknown) => value is T): T[] {
  try {
    const raw = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw.filter(isValid) : [];
  } catch { return []; }
}

export function writeStoredList<T>(storage: StorageLike, key: string, values: T[]) {
  storage.setItem(key, JSON.stringify(values));
}

export function buildProductShareText(name: string, formattedPrice: string, url: string) {
  return `${name} — ${formattedPrice} | PHONE STORE\n${url}`;
}

export const navigationCopy = {
  he: { inventory: "המלאי", categories: "קטגוריות", how: "איך זה עובד", customers: "לקוחות", contact: "צור קשר" },
  en: { inventory: "Inventory", categories: "Categories", how: "How it works", customers: "Customers", contact: "Contact" },
} as const;
