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
};

const TOKEN_TTL_SECONDS = 60 * 60 * 8; // one working day
const DATA_KEY = "site:data:v1";
const PREV_KEY = "site:data:v1:prev"; // the envelope replaced by the last publish: one-step undo
const SCHEMA = 1;
const MAX_BODY_BYTES = 512 * 1024;
const IMG_PREFIX = "img:";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"];

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

/** The shape check mirrors what the storefront needs to boot; content stays plain text. */
export function isPublishableAdminData(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const settings = data.settings;
  return Array.isArray(data.products) && Array.isArray(data.cats) && typeof settings === "object" && settings !== null;
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

export type UploadResult = { status: "ok"; url: string } | { status: "expired" } | { status: "no_store" } | { status: "too_large" } | { status: "bad_type" };

/**
 * Stores an uploaded photo under a fresh id. The id changes on every upload, so the bytes
 * behind a given URL never do and the response can be cached forever.
 */
export async function uploadImage(env: AdminEnv, token: string, contentType: string, imageBase64: string): Promise<UploadResult> {
  if (!env.STORE) return { status: "no_store" };
  if (!(await verifyToken(env, token))) return { status: "expired" };
  if (!IMAGE_TYPES.includes(contentType)) return { status: "bad_type" };

  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) return { status: "too_large" };

  const id = crypto.randomUUID().replace(/-/g, "");
  await env.STORE.put(IMG_PREFIX + id, bytes.buffer, { metadata: { ct: contentType } });
  return { status: "ok", url: `/img/${id}` };
}

/** Reads back an uploaded photo. Returns null for an unknown id or an unbound namespace. */
export async function readImage(env: AdminEnv, id: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!env.STORE || !/^[0-9a-f]{32}$/.test(id)) return null;
  const stored = await env.STORE.getWithMetadata(IMG_PREFIX + id, "arrayBuffer");
  if (!stored.value) return null;
  return { body: stored.value, contentType: stored.metadata?.ct ?? "application/octet-stream" };
}
