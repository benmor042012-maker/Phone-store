/**
 * Content administration, backed directly by the Cloudflare KV namespace the store has
 * always used.
 *
 * This used to be a proxy: the site called the original Worker's /api/admin/* over HTTP.
 * That Worker was replaced when this site was deployed under the same name, so the proxy
 * began calling the site itself, got the single-page-app HTML back instead of JSON, and
 * every login reported the service as unavailable. The admin now reads and writes the same
 * KV keys itself, so there is one Worker and no round trip.
 *
 * Key names, the token format and the envelope shape are unchanged from the original
 * Worker, so content published before the switch is picked up as it stands.
 */

/** Cloudflare bindings this module needs. Everything is optional so local dev degrades. */
export type AdminEnv = {
  STORE?: KVLike;
  ADMIN_PASSWORD?: string;
  ADMIN_TOKEN_SECRET?: string;
};

/** The slice of Cloudflare's KVNamespace used here, so tests can supply a plain object. */
export type KVLike = {
  get(key: string, type?: "text"): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown>;
  getWithMetadata(key: string, type: "arrayBuffer"): Promise<{ value: ArrayBuffer | null; metadata: { ct?: string } | null }>;
  put(key: string, value: string | ArrayBuffer, options?: { expirationTtl?: number; metadata?: Record<string, unknown> }): Promise<void>;
  delete(key: string): Promise<void>;
  /** Cloudflare's namespace has this; it is optional here so a test double need not. */
  list?(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    keys: { name: string; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }>;
};

import { normalizeOverrides, type CatalogOverrides } from "@shared/catalog-overrides";

const TOKEN_TTL_SECONDS = 60 * 60 * 8; // one working day
const DATA_KEY = "site:data:v1";
const OVERRIDES_KEY = "site:catalog:overrides:v1";
const OVERRIDES_PREV_KEY = "site:catalog:overrides:v1:prev";
const PREV_KEY = "site:data:v1:prev"; // the envelope replaced by the last publish: one-step undo
const SCHEMA = 1;
const MAX_BODY_BYTES = 512 * 1024;
const IMG_PREFIX = "img:";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"];
/** Clips are stored the same way photos are, so one player URL serves both. */
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
/** The catalogue of what has been uploaded. Without it an upload could never be found again. */
const MEDIA_KEY = "site:media:v1";
const MEDIA_LIMIT = 400;

/**
 * KV is eventually consistent and this read-modify-write is not atomic, so the counter is
 * best-effort: enough to make online guessing impractical, layered on the flat delay below.
 */
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 600;

export type AdminSession = { token: string; exp: number };
export type LoginResult =
  | { status: "ok"; session: AdminSession }
  | { status: "invalid" }
  | { status: "throttled" }
  | { status: "not_configured" };

/** Compares two strings without leaking length or position through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  // Fold the length difference into the result rather than returning early.
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64Url(mac)}`;
}

/**
 * A token is valid when re-signing its payload reproduces it exactly and the embedded
 * expiry is still ahead. Same primitive as issuing, so there is nothing to store.
 */
export async function verifyToken(env: AdminEnv, token: string): Promise<boolean> {
  const secret = env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD;
  if (!secret || typeof token !== "string") return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const expected = await sign(token.slice(0, dot), secret);
  if (!timingSafeEqual(token, expected)) return false;
  try {
    const payload = JSON.parse(atob(token.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export type LoginOptions = {
  /** The caller's address. Throttling is per address so one attacker cannot lock the store out. */
  ip?: string;
  /** Only tests set this to zero; in production every attempt pays the same flat delay. */
  delayMs?: number;
};

/** Checks the password against the Worker secret and issues a short-lived session. */
export async function login(env: AdminEnv, password: string, options: LoginOptions = {}): Promise<LoginResult> {
  const { ip = "unknown", delayMs = 400 } = options;
  const expected = env.ADMIN_PASSWORD;
  // Fail closed. A missing secret must never mean "let everyone in".
  if (!expected) return { status: "not_configured" };

  const attemptsKey = `rl:login:${ip}`;
  if (env.STORE) {
    const attempts = Number(await env.STORE.get(attemptsKey)) || 0;
    if (attempts >= LOGIN_MAX_ATTEMPTS) return { status: "throttled" };
  }

  // A flat delay on every attempt, right or wrong, so the response time says nothing.
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (!timingSafeEqual(password, expected)) {
    if (env.STORE) {
      const attempts = Number(await env.STORE.get(attemptsKey)) || 0;
      await env.STORE.put(attemptsKey, String(attempts + 1), { expirationTtl: LOGIN_WINDOW_SECONDS });
    }
    return { status: "invalid" };
  }

  if (env.STORE) await env.STORE.delete(attemptsKey);
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await sign(base64Url(new TextEncoder().encode(JSON.stringify({ exp }))), env.ADMIN_TOKEN_SECRET || expected);
  return { status: "ok", session: { token, exp } };
}

export type Envelope = { schema?: number; updatedAt?: string; data?: unknown };

/** The published envelope, or null when KV is unbound, empty or unreadable. */
export async function readEnvelope(env: AdminEnv): Promise<Envelope | null> {
  if (!env.STORE) return null;
  try {
    const envelope = (await env.STORE.get(DATA_KEY, "json")) as Envelope | null;
    return envelope && typeof envelope === "object" && (envelope.schema ?? 0) <= SCHEMA ? envelope : null;
  } catch {
    return null;
  }
}

/**
 * The shape check mirrors what the storefront needs to boot; content stays plain text.
 * `cats` and `products` are no longer required: the inventory comes from the shipped
 * catalog and the product overrides, so demanding them here only blocked valid content.
 */
export function isPublishableAdminData(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (typeof data.settings !== "object" || data.settings === null || Array.isArray(data.settings)) return false;
  for (const key of ["slides", "reviews", "cats", "products"]) {
    if (key in data && !Array.isArray(data[key])) return false;
  }
  return true;
}

export type PublishResult = { status: "ok"; updatedAt: string } | { status: "expired" } | { status: "no_store" } | { status: "too_large" } | { status: "invalid_data" };

/** Replaces the published envelope, keeping the previous one for a one-step undo. */
export async function publish(env: AdminEnv, token: string, data: unknown): Promise<PublishResult> {
  if (!env.STORE) return { status: "no_store" };
  if (!(await verifyToken(env, token))) return { status: "expired" };
  if (!isPublishableAdminData(data)) return { status: "invalid_data" };

  const settings = { ...(data.settings as Record<string, unknown>) };
  // Old backups may still carry the legacy plaintext password — never store it.
  delete settings.pw;
  const envelope = {
    schema: SCHEMA,
    updatedAt: new Date().toISOString(),
    data: { settings, slides: data.slides, cats: data.cats, products: data.products, reviews: data.reviews },
  };

  const serialized = JSON.stringify(envelope);
  if (serialized.length > MAX_BODY_BYTES) return { status: "too_large" };

  const previous = await env.STORE.get(DATA_KEY);
  if (previous) await env.STORE.put(PREV_KEY, previous);
  await env.STORE.put(DATA_KEY, serialized);
  return { status: "ok", updatedAt: envelope.updatedAt };
}

export type MediaKind = "image" | "video";

/** One item in the media library, as the admin panel lists it. */
export type MediaItem = {
  id: string;
  url: string;
  contentType: string;
  kind: MediaKind;
  size: number;
  name: string;
  uploadedAt: string;
};

export type UploadResult = { status: "ok"; url: string; item: MediaItem } | { status: "expired" } | { status: "no_store" } | { status: "too_large" } | { status: "bad_type" };

export function mediaKind(contentType: string): MediaKind | null {
  if (IMAGE_TYPES.includes(contentType)) return "image";
  if (VIDEO_TYPES.includes(contentType)) return "video";
  return null;
}

function asMediaItem(value: unknown): MediaItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id : "";
  const contentType = typeof item.contentType === "string" ? item.contentType : "";
  const kind = mediaKind(contentType);
  if (!/^[0-9a-f]{32}$/.test(id) || !kind) return null;
  return {
    id,
    url: `/img/${id}`,
    contentType,
    kind,
    size: typeof item.size === "number" && Number.isFinite(item.size) ? item.size : 0,
    name: typeof item.name === "string" ? item.name.slice(0, 120) : "",
    uploadedAt: typeof item.uploadedAt === "string" ? item.uploadedAt : "",
  };
}

async function readMediaIndex(env: AdminEnv): Promise<MediaItem[]> {
  if (!env.STORE) return [];
  try {
    const stored = await env.STORE.get(MEDIA_KEY, "json");
    return Array.isArray(stored) ? stored.map(asMediaItem).filter((item): item is MediaItem => item !== null) : [];
  } catch {
    return [];
  }
}

async function writeMediaIndex(env: AdminEnv, items: MediaItem[]): Promise<void> {
  if (!env.STORE) return;
  await env.STORE.put(MEDIA_KEY, JSON.stringify(items.slice(0, MEDIA_LIMIT)));
}

/**
 * Uploads made before this index existed left only their `img:` key behind, so the panel
 * had no way to list them. Walking the namespace once puts them back on the shelf; the
 * result is merged into the index so the walk is not repeated on every visit.
 */
async function backfillFromNamespace(env: AdminEnv, known: MediaItem[]): Promise<MediaItem[]> {
  if (!env.STORE?.list) return known;
  const seen = new Set(known.map((item) => item.id));
  const found: MediaItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const listing = await env.STORE.list({ prefix: IMG_PREFIX, cursor, limit: 200 });
    for (const key of listing.keys) {
      const id = key.name.slice(IMG_PREFIX.length);
      if (seen.has(id) || !/^[0-9a-f]{32}$/.test(id)) continue;
      const contentType = (key.metadata as { ct?: string } | undefined)?.ct ?? "image/jpeg";
      const item = asMediaItem({ id, contentType, size: 0, name: "", uploadedAt: "" });
      if (item) { found.push(item); seen.add(id); }
    }
    if (listing.list_complete || !listing.cursor) break;
    cursor = listing.cursor;
  }
  if (!found.length) return known;
  const merged = [...known, ...found];
  await writeMediaIndex(env, merged);
  return merged;
}

export type ListMediaResult = { status: "ok"; items: MediaItem[] } | { status: "expired" } | { status: "no_store" };

/** Everything the owner has uploaded, newest first. */
export async function listMedia(env: AdminEnv, token: string): Promise<ListMediaResult> {
  if (!env.STORE) return { status: "no_store" };
  if (!(await verifyToken(env, token))) return { status: "expired" };
  const items = await backfillFromNamespace(env, await readMediaIndex(env));
  const sorted = [...items].sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
  return { status: "ok", items: sorted };
}

/**
 * Stores an uploaded photo or clip under a fresh id and records it in the media index.
 * The id changes on every upload, so the bytes behind a given URL never do and the
 * response can be cached forever. The index is what lets the panel show it again later.
 */
export async function uploadMedia(env: AdminEnv, token: string, contentType: string, dataBase64: string, name = ""): Promise<UploadResult> {
  if (!env.STORE) return { status: "no_store" };
  if (!(await verifyToken(env, token))) return { status: "expired" };
  const kind = mediaKind(contentType);
  if (!kind) return { status: "bad_type" };

  let binary: string;
  try {
    binary = atob(dataBase64);
  } catch {
    return { status: "bad_type" };
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const limit = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (!bytes.byteLength || bytes.byteLength > limit) return { status: "too_large" };

  const id = crypto.randomUUID().replace(/-/g, "");
  await env.STORE.put(IMG_PREFIX + id, bytes.buffer, { metadata: { ct: contentType } });

  const item: MediaItem = { id, url: `/img/${id}`, contentType, kind, size: bytes.byteLength, name: name.slice(0, 120), uploadedAt: new Date().toISOString() };
  // A failed index write must not lose the upload itself, which is already stored and served.
  try {
    await writeMediaIndex(env, [item, ...(await readMediaIndex(env)).filter((entry) => entry.id !== id)]);
  } catch (error) {
    console.warn("[admin] Media index could not be updated", error);
  }
  return { status: "ok", url: item.url, item };
}

export type DeleteMediaResult = { status: "ok" } | { status: "expired" } | { status: "no_store" } | { status: "not_found" };

/** Removes an upload and its index entry. The bytes go; nothing else does. */
export async function deleteMedia(env: AdminEnv, token: string, id: string): Promise<DeleteMediaResult> {
  if (!env.STORE) return { status: "no_store" };
  if (!(await verifyToken(env, token))) return { status: "expired" };
  if (!/^[0-9a-f]{32}$/.test(id)) return { status: "not_found" };
  await env.STORE.delete(IMG_PREFIX + id);
  await writeMediaIndex(env, (await readMediaIndex(env)).filter((entry) => entry.id !== id));
  return { status: "ok" };
}

/** Reads back an uploaded photo or clip. Returns null for an unknown id or an unbound namespace. */
export async function readImage(env: AdminEnv, id: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!env.STORE || !/^[0-9a-f]{32}$/.test(id)) return null;
  const stored = await env.STORE.getWithMetadata(IMG_PREFIX + id, "arrayBuffer");
  if (!stored.value) return null;
  return { body: stored.value, contentType: stored.metadata?.ct ?? "application/octet-stream" };
}

/** The owner's catalog changes, or an empty set when nothing has been changed yet. */
export async function readOverrides(env: AdminEnv): Promise<CatalogOverrides> {
  if (!env.STORE) return normalizeOverrides(null);
  try {
    return normalizeOverrides(await env.STORE.get(OVERRIDES_KEY, "json"));
  } catch {
    return normalizeOverrides(null);
  }
}

export type SaveOverridesResult = { status: "ok"; updatedAt: string } | { status: "expired" } | { status: "no_store" } | { status: "too_large" };

/**
 * Replaces the owner's catalog changes, keeping the previous set for a one-step undo.
 * The value is normalized before it is stored, so a malformed field never reaches the
 * storefront and the same repair does not have to run on every read.
 */
export async function saveOverrides(env: AdminEnv, token: string, overrides: unknown): Promise<SaveOverridesResult> {
  if (!env.STORE) return { status: "no_store" };
  if (!(await verifyToken(env, token))) return { status: "expired" };

  const clean = { ...normalizeOverrides(overrides), updatedAt: new Date().toISOString() };
  const serialized = JSON.stringify(clean);
  if (serialized.length > MAX_BODY_BYTES) return { status: "too_large" };

  const previous = await env.STORE.get(OVERRIDES_KEY);
  if (previous) await env.STORE.put(OVERRIDES_PREV_KEY, previous);
  await env.STORE.put(OVERRIDES_KEY, serialized);
  return { status: "ok", updatedAt: clean.updatedAt as string };
}
