/**
 * Storefront artwork. Files live under `client/public/images/` and are served as static
 * assets, so the storefront no longer depends on a storage proxy being reachable.
 */

/** Shown in place of any picture that fails to load, so a missing file never looks broken. */
export const IMAGE_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="תמונת מוצר">
      <rect width="400" height="300" fill="#12110f"/>
      <g fill="none" stroke="#d5a945" stroke-opacity=".45" stroke-width="4">
        <rect x="163" y="66" width="74" height="168" rx="14"/>
      </g>
      <rect x="182" y="79" width="36" height="9" rx="4.5" fill="#d5a945" fill-opacity=".4"/>
      <circle cx="200" cy="216" r="6" fill="#d5a945" fill-opacity=".4"/>
    </svg>`,
  );

/** Swaps in the placeholder once; the guard stops a broken fallback from looping. */
export function onImageError(event: { currentTarget: HTMLImageElement }) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied) return;
  image.dataset.fallbackApplied = "true";
  image.src = IMAGE_FALLBACK;
}

/** Product artwork by catalog id. Drop a file with the matching name into `client/public/images/products/`. */
export const productImages: Record<string, string> = {
  1: "/images/products/iphone-17-pro-max.webp",
  2: "/images/products/samsung-galaxy-s25-ultra.webp",
  3: "/images/products/airpods-pro-2.webp",
  4: "/images/products/ipad-pro-m4-11.webp",
  5: "/images/products/apple-watch-ultra-2.webp",
  6: "/images/products/xiaomi-14-ultra.webp",
  7: "/images/products/google-pixel-9-pro.webp",
  8: "/images/products/samsung-galaxy-watch-7.webp",
  9: "/images/products/anker-powercore-20000.webp",
  10: "/images/products/wall-charger-65w.webp",
  11: "/images/products/usb-c-cable-2m.webp",
  12: "/images/products/screen-protector.webp",
  13: "/images/products/magsafe-silicone-case.webp",
  14: "/images/products/sony-wh-1000xm5.webp",
  15: "/images/products/oneplus-13.webp",
};

/** Category artwork by category name, in `client/public/images/categories/`. */
export const categoryImages: Record<string, string> = {
  "טלפונים סלולריים": "/images/categories/phones.webp",
  "טאבלטים": "/images/categories/tablets.webp",
  "שעונים חכמים": "/images/categories/watches.webp",
  "אוזניות": "/images/categories/headphones.webp",
  "מטענים": "/images/categories/chargers.webp",
  "כבלים": "/images/categories/cables.webp",
  "מגני מסך": "/images/categories/screen-protectors.webp",
  "כיסויים": "/images/categories/cases.webp",
  "סוללות גיבוי": "/images/categories/power-banks.webp",
  "מבצעים": "/images/categories/deals.webp",
};

/** Falls back to the placeholder rather than to an unrelated product picture. */
export function productImage(id: string): string {
  return productImages[id] ?? IMAGE_FALLBACK;
}

export function categoryImage(name: string): string {
  return categoryImages[name] ?? IMAGE_FALLBACK;
}
