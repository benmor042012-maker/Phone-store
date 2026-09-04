/** Read-only adapter for the public source storefront API; it never writes to the source KV. */

export const SOURCE_STOREFRONT_URL = "https://phone-store.ben-mor-04-2012.workers.dev/api/data";
export const SOURCE_ORIGIN = "https://phone-store.ben-mor-04-2012.workers.dev";

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
  const rawCategories = Array.isArray(data.categories) ? data.categories : [];
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

export async function readSourceStorefront(fetchImpl: typeof fetch = fetch): Promise<SourceStorefront> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetchImpl(SOURCE_STOREFRONT_URL, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Source storefront returned ${response.status}`);
    return normalizeStorefrontPayload(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

export type SourceAdminSession = { token: string; exp: number };

export class SourceAdminError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

async function sourceRequest(path: string, init: RequestInit, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetchImpl(`${SOURCE_ORIGIN}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function loginToSourceAdmin(password: string, fetchImpl: typeof fetch = fetch): Promise<SourceAdminSession> {
  const response = await sourceRequest("/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json", Accept: "application/json" }, body: JSON.stringify({ password }),
  }, fetchImpl);
  if (!response.ok) throw new SourceAdminError(response.status, "Source administrator login failed");
  const body = asRecord(await response.json());
  const token = stringValue(body.token);
  const exp = numberValue(body.exp);
  if (!token || !exp) throw new SourceAdminError(502, "Source administrator session was incomplete");
  return { token, exp };
}

export async function readSourceAdminData(fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const response = await sourceRequest("/api/data", { method: "GET", headers: { Accept: "application/json" } }, fetchImpl);
  if (!response.ok) throw new SourceAdminError(response.status, "Source data was unavailable");
  const payload = asRecord(await response.json());
  return payload.data ?? payload;
}

export function isPublishableSourceData(value: unknown): value is UnknownRecord {
  const data = asRecord(value);
  const categories = Array.isArray(data.cats) || Array.isArray(data.categories);
  return Object.keys(data).length > 0 && Object.keys(asRecord(data.settings)).length > 0 && Array.isArray(data.slides) && categories && Array.isArray(data.products) && Array.isArray(data.reviews);
}

export async function publishToSourceAdmin(token: string, data: UnknownRecord, fetchImpl: typeof fetch = fetch): Promise<{ updatedAt: string | null }> {
  const response = await sourceRequest("/api/data", {
    method: "PUT", headers: { "content-type": "application/json", Accept: "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(data),
  }, fetchImpl);
  if (!response.ok) throw new SourceAdminError(response.status, "Source content publish failed");
  const body = asRecord(await response.json());
  return { updatedAt: stringValue(body.updatedAt) || null };
}

export async function uploadToSourceAdmin(token: string, contentType: string, imageBase64: string, fetchImpl: typeof fetch = fetch): Promise<{ url: string }> {
  const bytes = Buffer.from(imageBase64, "base64");
  if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new SourceAdminError(413, "Source image was too large");
  const response = await sourceRequest("/api/upload", {
    method: "POST", headers: { "content-type": contentType, Accept: "application/json", authorization: `Bearer ${token}` }, body: bytes,
  }, fetchImpl);
  if (!response.ok) throw new SourceAdminError(response.status, "Source image upload failed");
  const body = asRecord(await response.json());
  const relativeUrl = stringValue(body.url);
  if (!relativeUrl) throw new SourceAdminError(502, "Source image upload response was incomplete");
  return { url: sourceAssetUrl(relativeUrl, relativeUrl) };
}

export function sourceAssetUrl(path: string | null, fallback: string): string {
  if (!path) return fallback;
  if (/^https?:\/\//.test(path)) return path;
  return `${SOURCE_ORIGIN}/${path.replace(/^\/+/, "")}`;
}
