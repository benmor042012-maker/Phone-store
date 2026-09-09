/**
 * Link-preview metadata for WhatsApp, Facebook, Twitter and iMessage.
 *
 * The storefront is a single-page app, so `client/src/lib/seo.ts` only updates the head
 * after React has mounted. Preview crawlers never run JavaScript: whatever they scrape is
 * whatever the server put in the HTML. This module builds that metadata so the worker can
 * write it into the document before it leaves the edge.
 */

import { SHARE_IMAGE } from "@shared/const";

export type SocialProduct = {
  id: string;
  name?: string;
  brand?: string;
  category?: string;
  price?: number;
  image?: string;
  description?: string;
};

export type SocialCatalog = { products?: SocialProduct[] };

export type SocialMeta = {
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt: string;
  imageWidth: string;
  imageHeight: string;
  imageType: string;
  type: "website" | "product";
  price?: number;
};

const STORE_NAME = "Phone Store";
const STORE_CITY = "נתניה";

/** WhatsApp truncates the card at roughly this length; cutting on a word keeps it readable. */
function clamp(text: string, limit: number) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  const cut = collapsed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function absolute(origin: string, value: string) {
  return value.startsWith("http") ? value : `${origin.replace(/\/+$/, "")}${value}`;
}

/** Returns the product id for /products/:id, or null for every other path. */
export function productIdFromPath(pathname: string): string | null {
  const match = /^\/products\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return id.trim() ? id : null;
}

/** Prices render as ₪1,299 so the card reads the way the price does on the page. */
function shekels(price: number) {
  return `₪${Math.round(price).toLocaleString("en-US")}`;
}

/** The card a product URL should show: what the item is, what it costs, how to order it. */
export function buildProductSocialMeta(origin: string, product: SocialProduct): SocialMeta {
  const base = origin.replace(/\/+$/, "");
  const name = (product.name ?? "").trim() || `מוצר ${product.id}`;
  const priced = typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0;
  const lead = priced ? `${shekels(product.price as number)} · ` : "";
  const detail = (product.description ?? "").trim() || `${product.category ?? "אביזר"} ${product.brand ?? ""}`.trim();
  return {
    title: clamp(`${name} | ${STORE_NAME} ${STORE_CITY}`, 90),
    description: clamp(`${lead}${detail} — הזמנה בוואטסאפ מ${STORE_NAME} ${STORE_CITY}, תשלום בביט או בפייבוקס, משלוח חינם מעל ₪299.`, 200),
    canonical: `${base}/products/${encodeURIComponent(product.id)}`,
    image: product.image ? absolute(base, product.image) : `${base}${SHARE_IMAGE.path}`,
    imageAlt: name,
    // Catalog photography is square-ish product art, so only the shipped share card can
    // claim the 1200x630 dimensions; lying about them makes WhatsApp drop the image.
    imageWidth: product.image ? "" : SHARE_IMAGE.width,
    imageHeight: product.image ? "" : SHARE_IMAGE.height,
    imageType: product.image ? "" : SHARE_IMAGE.type,
    type: "product",
    price: priced ? (product.price as number) : undefined,
  };
}

/** Finds a product in the shipped catalog by id. */
export function findProduct(catalog: SocialCatalog, id: string): SocialProduct | null {
  return (catalog.products ?? []).find((product) => product && product.id === id) ?? null;
}

export type SocialMetaTag = { attribute: "property" | "name"; key: string; content: string | null };

/**
 * Every tag the document must end up with. A null content means the tag the static HTML
 * ships is wrong for this page and has to go — a stale og:image:width makes WhatsApp drop
 * the image rather than fall back to the real one.
 */
export function socialMetaTags(meta: SocialMeta): SocialMetaTag[] {
  const priced = typeof meta.price === "number";
  return [
    { attribute: "property", key: "og:title", content: meta.title },
    { attribute: "property", key: "og:description", content: meta.description },
    { attribute: "property", key: "og:url", content: meta.canonical },
    { attribute: "property", key: "og:type", content: meta.type },
    { attribute: "property", key: "og:image", content: meta.image },
    { attribute: "property", key: "og:image:secure_url", content: meta.image },
    { attribute: "property", key: "og:image:alt", content: meta.imageAlt },
    { attribute: "property", key: "og:image:width", content: meta.imageWidth || null },
    { attribute: "property", key: "og:image:height", content: meta.imageHeight || null },
    { attribute: "property", key: "og:image:type", content: meta.imageType || null },
    { attribute: "property", key: "product:price:amount", content: priced ? String(meta.price) : null },
    { attribute: "property", key: "product:price:currency", content: priced ? "ILS" : null },
    { attribute: "property", key: "og:availability", content: priced ? "instock" : null },
    { attribute: "name", key: "description", content: meta.description },
    { attribute: "name", key: "twitter:title", content: meta.title },
    { attribute: "name", key: "twitter:description", content: meta.description },
    { attribute: "name", key: "twitter:image", content: meta.image },
    { attribute: "name", key: "twitter:image:alt", content: meta.imageAlt },
  ];
}
