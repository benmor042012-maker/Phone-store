/**
 * The store inventory. Accessories come from `public/catalog.json`, which ships with the
 * site, and the phones Eli sells are listed here until the shop's own photos replace them.
 */
import { applyOverrides, EMPTY_OVERRIDES, normalizeOverrides, visibleCategories } from "@shared/catalog-overrides";
import { useEffect, useMemo, useState } from "react";
import { productImage } from "./images";
import { trpc } from "./trpc";

export type Product = {
  id: string;
  brand: string;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  image: string;
  facts: [string, string][];
  badge?: "מבצע" | "חדש";
  description?: string;
  /** Set while the shop's own photo of this item is still missing. */
  awaitingPhoto?: boolean;
};

type CatalogFile = { categories: string[]; products: Product[] };

export const PHONES_CATEGORY = "טלפונים סלולריים";

/**
 * Handsets carried in the shop. Prices are the ones captured from the previous site and
 * still need the shop's confirmation; the artwork falls back to the branded placeholder
 * until real photos of the stock are added.
 */
export const storePhones: Product[] = [
  { id: "phone-1", awaitingPhoto: true, brand: "Apple", name: "iPhone 17 Pro Max 256GB", category: PHONES_CATEGORY, price: 4900, oldPrice: 5400, image: productImage("1"), badge: "מבצע", facts: [["מעבד", "A18 Pro"], ["מסך", "6.9 אינץ׳"], ["אחסון", "256GB"]] },
  { id: "phone-2", awaitingPhoto: true, brand: "Samsung", name: "Samsung Galaxy S25 Ultra", category: PHONES_CATEGORY, price: 4799, oldPrice: 5299, image: productImage("2"), badge: "מבצע", facts: [["מעבד", "Snapdragon 8 Elite"], ["מסך", "6.9 אינץ׳"], ["אחסון", "512GB"]] },
  { id: "phone-6", awaitingPhoto: true, brand: "Xiaomi", name: "Xiaomi 14 Ultra", category: PHONES_CATEGORY, price: 3499, image: productImage("6"), badge: "חדש", facts: [["מעבד", "Snapdragon 8 Gen 3"], ["מסך", "6.73 אינץ׳"], ["מצלמה", "Leica 50MP"]] },
  { id: "phone-7", awaitingPhoto: true, brand: "Google", name: "Google Pixel 9 Pro", category: PHONES_CATEGORY, price: 3999, image: productImage("7"), badge: "חדש", facts: [["מעבד", "Tensor G4"], ["מסך", "6.3 אינץ׳"], ["אחסון", "256GB"]] },
  { id: "phone-15", awaitingPhoto: true, brand: "OnePlus", name: "OnePlus 13", category: PHONES_CATEGORY, price: 3199, image: productImage("15"), badge: "חדש", facts: [["מעבד", "Snapdragon 8 Elite"], ["טעינה", "100W"], ["אחסון", "256GB"]] },
  { id: "tablet-4", awaitingPhoto: true, brand: "Apple", name: "iPad Pro M4 11\"", category: "טאבלטים", price: 4299, image: productImage("4"), badge: "חדש", facts: [["מעבד", "M4"], ["מסך", "11 אינץ׳ OLED"], ["אחסון", "256GB"]] },
  { id: "watch-5", awaitingPhoto: true, brand: "Apple", name: "Apple Watch Ultra 2", category: "אביזרים לשעונים", price: 3299, oldPrice: 3599, image: productImage("5"), badge: "מבצע", facts: [["מסך", "49 מ״מ"], ["סוללה", "עד 72 שעות"], ["עמידות", "100 מטר"]] },
  { id: "watch-8", awaitingPhoto: true, brand: "Samsung", name: "Samsung Galaxy Watch 7", category: "אביזרים לשעונים", price: 1299, image: productImage("8"), badge: "חדש", facts: [["מסך", "44 מ״מ"], ["סוללה", "עד 40 שעות"]] },
];

const FALLBACK_CATEGORIES = [PHONES_CATEGORY, "טאבלטים", "אביזרים לשעונים"];

/** Loads the shipped catalog once, without the shop owner's changes applied. */
export function useBaseInventory() {
  const [state, setState] = useState<{ products: Product[]; categories: string[]; ready: boolean }>({
    products: storePhones,
    categories: FALLBACK_CATEGORIES,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/catalog.json", { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
        return response.json() as Promise<CatalogFile>;
      })
      .then((catalog) => {
        if (cancelled || !Array.isArray(catalog.products)) return;
        setState({
          products: [...storePhones, ...catalog.products],
          categories: Array.from(new Set([PHONES_CATEGORY, ...catalog.categories])),
          ready: true,
        });
      })
      .catch((error) => {
        // The shop's own handsets stay listed even if the catalog file cannot be read.
        console.warn("[catalog] falling back to the built-in list", error);
        if (!cancelled) setState((current) => ({ ...current, ready: true }));
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}

/**
 * What customers see: the shipped catalog with the owner's edits applied, hidden items
 * gone, and their own products in front. Overrides come from the content store; a failure
 * there leaves the catalog showing exactly as it shipped rather than showing nothing.
 */
export function useInventory() {
  const base = useBaseInventory();
  const overridesQuery = trpc.storefront.catalogOverrides.useQuery(undefined, { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false });
  const overrides = useMemo(() => normalizeOverrides(overridesQuery.data ?? EMPTY_OVERRIDES), [overridesQuery.data]);

  return useMemo(() => {
    const products = applyOverrides(base.products, overrides);
    return {
      products,
      categories: visibleCategories(products, base.categories),
      ready: base.ready && !overridesQuery.isLoading,
    };
  }, [base.categories, base.products, base.ready, overrides, overridesQuery.isLoading]);
}

/** Category tiles borrow the first picture in the category, so every tile shows real stock. */
export function categoryThumbnails(products: Product[]): Record<string, string> {
  const thumbnails: Record<string, string> = {};
  for (const product of products) {
    if (!thumbnails[product.category] && !product.awaitingPhoto) {
      thumbnails[product.category] = product.image;
    }
  }
  return thumbnails;
}
