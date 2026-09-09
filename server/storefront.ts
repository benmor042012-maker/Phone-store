/**
 * Shapes the published content envelope into what the storefront renders.
 *
 * The envelope used to be fetched from a second Worker over HTTP. It is now read straight
 * out of KV by `admin-store.ts`, so this file only normalizes — it makes no requests.
 */

type UnknownRecord = Record<string, unknown>;

export type StorefrontProduct = {
  id: string;
  img: string | null;
  name: string;
  brand: string;
  cat: string;
  price: number;
  was: number | null;
  tag: string;
  pop: number;
  specs: Record<string, string | number>;
  desc: string;
};

export type StorefrontCategory = { id: string; name: string; icon: string; img: string | null };
export type StorefrontSlide = { id: string; mark: string; title: string; accent: string; lead: string };
export type StorefrontSettings = { name: string; sub: string; tel: string; telShow: string; wa: string; mail: string; addr: string; ship: number; pay36: number };
export type StorefrontReview = { id: string; name: string; when: string; stars: number; text: string };
export type SourceStorefront = { updatedAt: string | null; settings: StorefrontSettings; categories: StorefrontCategory[]; products: StorefrontProduct[]; slides: StorefrontSlide[]; reviews: StorefrontReview[] };

function asRecord(value: unknown): UnknownRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {}; }
/** The storefront is branded "Phone Store"; live source text may still carry the former store name. */
const STORE_NAME = "Phone Store";
const LEGACY_STORE_NAME = /\u05e1\u05d9\u05d8\u05d9\s*\u05e1\u05dc/g;
export function withStoreName(value: string): string { return value.replace(LEGACY_STORE_NAME, STORE_NAME); }
function stringValue(value: unknown, fallback = ""): string { return typeof value === "string" ? withStoreName(value) : fallback; }
function numberValue(value: unknown, fallback = 0): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function imageValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }

export function normalizeStorefrontPayload(payload: unknown): SourceStorefront {
  const envelope = asRecord(payload);
  const data = asRecord(envelope.data ?? payload);
  const settingsRaw = asRecord(data.settings);
  const rawProducts = Array.isArray(data.products) ? data.products : [];
  // The admin panel and the stored envelope call these `cats`; older exports say
  // `categories`. Reading only one of the two silently dropped every category tile.
  const rawCategories = Array.isArray(data.cats) ? data.cats : Array.isArray(data.categories) ? data.categories : [];
  const rawSlides = Array.isArray(data.slides) ? data.slides : [];
  const rawReviews = Array.isArray(data.reviews) ? data.reviews : [];

  return {
    updatedAt: stringValue(envelope.updatedAt) || null,
    settings: {
      name: stringValue(settingsRaw.name, "Phone Store"), sub: stringValue(settingsRaw.sub), tel: stringValue(settingsRaw.tel),
      telShow: stringValue(settingsRaw.telShow), wa: stringValue(settingsRaw.wa), mail: stringValue(settingsRaw.mail),
      addr: stringValue(settingsRaw.addr), ship: numberValue(settingsRaw.ship, 299), pay36: numberValue(settingsRaw.pay36, 36),
    },
    categories: rawCategories.map((entry) => {
      const item = asRecord(entry);
      const img = imageValue(item.img);
      return { id: stringValue(item.id), name: stringValue(item.name), icon: stringValue(item.icon), img: img ? sourceAssetUrl(img, img) : null };
    }).filter((item) => item.id && item.name),
    products: rawProducts.map((entry) => {
      const item = asRecord(entry);
      const rawSpecs = asRecord(item.specs);
      const specs: Record<string, string | number> = Object.fromEntries(
        Object.entries(rawSpecs)
          .filter(([, value]) => typeof value === "string" || typeof value === "number")
          .map(([key, value]) => [withStoreName(key), typeof value === "string" ? withStoreName(value) : value]),
      ) as Record<string, string | number>;
      const img = imageValue(item.img);
      return { id: stringValue(item.id), img: img ? sourceAssetUrl(img, img) : null, name: stringValue(item.name), brand: stringValue(item.brand), cat: stringValue(item.cat), price: numberValue(item.price), was: typeof item.was === "number" ? item.was : null, tag: stringValue(item.tag), pop: numberValue(item.pop), specs, desc: stringValue(item.desc) };
    }).filter((item) => item.id && item.name && item.price >= 0),
    slides: rawSlides.map((entry) => {
      const item = asRecord(entry);
      return { id: stringValue(item.id), mark: stringValue(item.mark), title: stringValue(item.title), accent: stringValue(item.accent), lead: stringValue(item.lead) };
    }).filter((item) => item.id && item.title),
    reviews: rawReviews.map((entry) => {
      const item = asRecord(entry);
      return { id: stringValue(item.id), name: stringValue(item.name), when: stringValue(item.when), stars: Math.max(0, Math.min(5, numberValue(item.stars))), text: stringValue(item.text) };
    }).filter((item) => item.id && item.name && item.text),
  };
}

/**
 * Published content stores image paths relative to the site: `img/<id>` for a photo the
 * admin uploaded, `assets/...` for artwork that shipped with it. They resolve against this
 * origin now that the store is served here, so they only need a leading slash.
 */
export function sourceAssetUrl(path: string | null, fallback: string): string {
  if (!path) return fallback;
  if (/^https?:\/\//.test(path)) return path;
  return `/${path.replace(/^\/+/, "")}`;
}
