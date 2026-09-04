/** Search-engine metadata for the storefront: document meta tags plus schema.org structured data. */
import { socialLinks, STORE } from "./storefrontState";

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  if (typeof document === "undefined") return;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  if (typeof document === "undefined") return;
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export type PageSeo = { title: string; description: string; path: string; image?: string; type?: "website" | "product" };

/** Applies the canonical URL, the description and the Open Graph / Twitter cards for the current view. */
export function applyPageSeo({ title, description, path, image, type = "website" }: PageSeo) {
  if (typeof document === "undefined") return;
  const origin = typeof window !== "undefined" && window.location.origin.startsWith("http") ? window.location.origin : STORE.site;
  const url = `${origin}${path}`;
  const banner = image ? (image.startsWith("http") ? image : `${origin}${image}`) : `${origin}${STORE.logo}`;
  document.title = title;
  document.documentElement.lang = "he";
  upsertMeta('meta[name="description"]', "name", "description", description);
  upsertLink("canonical", url);
  upsertMeta('meta[property="og:title"]', "property", "og:title", title);
  upsertMeta('meta[property="og:description"]', "property", "og:description", description);
  upsertMeta('meta[property="og:url"]', "property", "og:url", url);
  upsertMeta('meta[property="og:image"]', "property", "og:image", banner);
  upsertMeta('meta[property="og:type"]', "property", "og:type", type === "product" ? "product" : "website");
  upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
  upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", banner);
}

/** Writes (or clears, when data is null) a named JSON-LD block in the document head. */
export function applyJsonLd(id: string, data: unknown) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(id);
  if (!data) { existing?.remove(); return; }
  const script = existing instanceof HTMLScriptElement ? existing : document.createElement("script");
  script.type = "application/ld+json";
  script.id = id;
  script.textContent = JSON.stringify(data);
  if (!script.isConnected) document.head.appendChild(script);
}

export function buildStoreJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "MobilePhoneStore",
    "@id": `${origin}/#store`,
    name: STORE.name,
    legalName: STORE.legalName,
    description: `${STORE.name} נתניה — מכירת טלפונים סלולריים, טאבלטים, שעונים חכמים ואביזרים, עם ייעוץ אישי של ${STORE.owner}.`,
    image: `${origin}${STORE.logo}`,
    logo: `${origin}${STORE.logo}`,
    url: origin,
    telephone: STORE.phone,
    email: STORE.email,
    priceRange: "₪₪",
    currenciesAccepted: "ILS",
    paymentAccepted: "ביט, פייבוקס, כרטיס אשראי, מזומן",
    address: { "@type": "PostalAddress", streetAddress: STORE.street, addressLocality: STORE.city, postalCode: STORE.postalCode, addressCountry: STORE.country },
    geo: { "@type": "GeoCoordinates", latitude: STORE.latitude, longitude: STORE.longitude },
    areaServed: [{ "@type": "City", name: "נתניה" }, { "@type": "Country", name: "ישראל" }],
    sameAs: socialLinks.map((link) => link.href),
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], opens: "09:00", closes: "19:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Friday", opens: "09:00", closes: "14:00" },
    ],
  };
}

export type SeoProduct = { id: string; name: string; brand: string; category: string; price: number; image: string; description: string };

export function buildProductJsonLd(origin: string, product: SeoProduct) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${origin}/products/${product.id}#product`,
    name: product.name,
    sku: product.id,
    category: product.category,
    description: product.description,
    image: product.image.startsWith("http") ? product.image : `${origin}${product.image}`,
    brand: { "@type": "Brand", name: product.brand },
    offers: {
      "@type": "Offer",
      url: `${origin}/products/${product.id}`,
      priceCurrency: "ILS",
      price: product.price,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${origin}/#store` },
    },
  };
}

export function buildCatalogJsonLd(origin: string, products: SeoProduct[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `המלאי של ${STORE.name}`,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${origin}/products/${product.id}`,
      name: product.name,
    })),
  };
}
