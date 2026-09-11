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

/**
 * The picture to render for a product. A product saved without one carries an empty string,
 * and an empty `src` never fails, so `onImageError` is never reached and the card is left
 * with a blank hole where the photo belongs. Resolving it here is what fills that hole.
 */
export function productPicture(src: string | undefined): string {
  return src && src.trim() ? src : IMAGE_FALLBACK;
}

/** Swaps in the placeholder once; the guard stops a broken fallback from looping. */
export function onImageError(event: { currentTarget: HTMLImageElement }) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied) return;
  image.dataset.fallbackApplied = "true";
  image.src = IMAGE_FALLBACK;
}

/**
 * Artwork for the handsets the shop stocks itself, one entry per item in `storePhones`.
 * Each path currently holds a branded placeholder; overwrite the file with a real photo
 * of the stock and it appears on the site, no code change needed.
 */
export const productImages: Record<string, string> = {
  1: "/images/products/iphone-17-pro-max.webp",
  2: "/images/products/samsung-galaxy-s25-ultra.webp",
  4: "/images/products/ipad-pro-m4-11.webp",
  5: "/images/products/apple-watch-ultra-2.webp",
  6: "/images/products/xiaomi-14-ultra.webp",
  7: "/images/products/google-pixel-9-pro.webp",
  8: "/images/products/samsung-galaxy-watch-7.webp",
  15: "/images/products/oneplus-13.webp",
};

/** Falls back to the placeholder rather than to an unrelated product picture. */
export function productImage(id: string): string {
  return productImages[id] ?? IMAGE_FALLBACK;
}
