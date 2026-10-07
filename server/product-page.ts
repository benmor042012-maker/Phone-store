/**
 * The body of a product page, as the server sends it.
 *
 * The storefront is a single-page app: without this, every one of the ~1,800 product URLs
 * in the sitemap arrives at a crawler carrying the home page's markup, so the shop looks
 * like 1,800 copies of one page. This builds a small, real page for each product — its own
 * heading, price, specification and picture — which React then replaces on mount with the
 * interactive catalogue.
 *
 * Everything here is a pure string function so it can be tested under Node; the worker
 * streams it into the document with HTMLRewriter, which only exists inside workerd.
 */
import type { CatalogProduct } from "../shared/catalog-overrides";

/** The shop's own pages a product should point at, by what the product is. */
const PHONE_CATEGORIES = ["טלפונים סלולריים", "טאבלטים"];

/** Escapes a value for HTML text or a double-quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** ₪1,299 — the same way the price reads on the page. */
export function shekels(price: number): string {
  return `₪${Math.round(price).toLocaleString("en-US")}`;
}

function absolute(origin: string, path: string) {
  return path.startsWith("http") ? path : `${origin.replace(/\/+$/, "")}${path}`;
}

export type ProductPageOptions = {
  /** The shop's WhatsApp number, digits only. */
  whatsapp: string;
  /** What the shop is called, for the breadcrumb. */
  storeName: string;
  city: string;
};

/**
 * The static markup for one product. One `<h1>`, the price and specification the page
 * shows, and links back into the shop so the page is not a dead end for a crawler.
 */
export function buildProductBodyHtml(origin: string, product: CatalogProduct, options: ProductPageOptions): string {
  const name = escapeHtml((product.name ?? "").trim() || `מוצר ${product.id}`);
  const brand = escapeHtml((product.brand ?? "").trim());
  const category = escapeHtml((product.category ?? "").trim());
  const priced = typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0;
  const image = product.image ? escapeHtml(absolute(origin, product.image)) : "";
  const description = escapeHtml((product.description ?? "").trim());
  const facts = (product.facts ?? []).filter((fact) => Array.isArray(fact) && fact.length === 2);
  const isPhone = PHONE_CATEGORIES.includes((product.category ?? "").trim());
  const related = isPhone ? "/iphone" : "/accessories";
  const relatedLabel = isPhone ? "אייפון וסמסונג בנתניה" : "אביזרים לסלולר בנתניה";
  const order = `היי אלי, אני מעוניין/ת ב${(product.name ?? "").trim() || `מוצר ${product.id}`}${priced ? ` (${shekels(product.price)})` : ""}. זמין?`;
  const whatsapp = escapeHtml(`https://wa.me/${options.whatsapp}?text=${encodeURIComponent(order)}`);
  const store = escapeHtml(`${options.storeName} ${options.city}`);

  return [
    `<div class="store-page landing-page" dir="rtl">`,
    `<main>`,
    `<article class="section-shell landing-article">`,
    `<nav class="breadcrumbs" aria-label="פירורי לחם"><ol>`,
    `<li><a href="/">${store}</a></li>`,
    category ? `<li><a href="/#catalog">${category}</a></li>` : "",
    `<li aria-current="page">${name}</li>`,
    `</ol></nav>`,
    brand ? `<p class="section-kicker"><span>${brand}</span></p>` : "",
    `<h1>${name}</h1>`,
    image ? `<img src="${image}" alt="${name}${brand ? ` — ${brand}` : ""}" width="480" height="480" decoding="async" />` : "",
    priced ? `<p class="landing-intro"><strong>${shekels(product.price)}</strong>${product.oldPrice ? ` <del>${shekels(product.oldPrice)}</del>` : ""} · זמין ב־${store}, ${escapeHtml("שדרות בן גוריון 2")}</p>` : "",
    description ? `<p>${description}</p>` : "",
    facts.length ? `<ul>${facts.map(([label, value]) => `<li><b>${escapeHtml(String(label))}:</b> ${escapeHtml(String(value))}</li>`).join("")}</ul>` : "",
    `<div class="hero-buttons landing-cta">`,
    `<a class="btn-gold" href="${whatsapp}" rel="noreferrer">הזמנה בוואטסאפ</a>`,
    `<a class="btn-outline" href="/#catalog">לכל המלאי</a>`,
    `</div>`,
    `<nav class="landing-related" aria-label="עמודים קשורים">`,
    `<b>ממשיכים מכאן</b>`,
    `<a class="text-gold" href="${related}">${relatedLabel}</a>`,
    `<a class="text-gold" href="/repairs">תיקון סלולרי בנתניה</a>`,
    `<a class="text-gold" href="/">חנות סלולרי בנתניה</a>`,
    `</nav>`,
    `</article>`,
    `</main>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("");
}
