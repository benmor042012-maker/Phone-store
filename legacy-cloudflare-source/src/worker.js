/**
 * phone-store Worker
 *
 * The site itself is static. The Worker adds the two things static hosting
 * cannot do:
 *
 *   1. The admin password is checked here against a Cloudflare secret, so it
 *      never reaches the browser.
 *   2. Site content lives in a KV namespace (binding: STORE), so an edit made
 *      in the admin panel is published to every visitor — not, as before,
 *      written only to the editor's own localStorage.
 *
 * Set the secret with:  npx wrangler secret put ADMIN_PASSWORD
 * Optionally also:      npx wrangler secret put ADMIN_TOKEN_SECRET
 * Provision content:    npx wrangler kv namespace create STORE
 *                       (then paste the id into wrangler.jsonc — see README)
 *
 * With STORE bound, the admin panel IS a security boundary: a valid login
 * token is required to write the content every visitor sees. Without STORE
 * (local dev before provisioning, or the binding commented out) every route
 * degrades to the old behavior — the page boots on its built-in defaults and
 * publishing is unavailable.
 */

const TOKEN_TTL_SECONDS = 60 * 60 * 8; // one working day

/* One JSON blob under one key. Additive field changes need no new key —
   the page's normalizeData() repairs and migrates on every read. A breaking
   reshape moves to site:data:v2 and the code here learns to fall back. */
const DATA_KEY = 'site:data:v1';
const PREV_KEY = 'site:data:v1:prev'; // previous envelope: one-step undo
const SCHEMA = 1;
const MAX_BODY_BYTES = 512 * 1024; // whole catalog today is ~14 KB

/* Uploaded product photos. The browser downsizes to WebP before sending, so
   2 MB is a generous ceiling for a real photograph, well under KV's 25 MB
   value limit. Keys are img:<uid>; the uid is unique per upload, which is
   what lets the served bytes be cached forever. */
const IMG_PREFIX = 'img:';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

/* Login throttling. KV is eventually consistent and read-modify-write here is
   not atomic, so this is best-effort throttling layered on the flat delay
   below — enough to make online guessing impractical, not a hard gate. */
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 600;

/** Compare two strings without leaking length or position through timing. */
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Fold the length difference into the result rather than returning early.
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

const b64url = bytes =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${b64url(mac)}`;
}

/* A token is valid when re-signing its payload with our secret reproduces it
   exactly, and its embedded expiry is still in the future. Same primitive as
   issuing — there is nothing to store server-side. */
async function verifyToken(token, env) {
  const secret = env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD;
  if (!secret || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const expected = await sign(payload, secret);
  if (!timingSafeEqual(token, expected)) return false;
  try {
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp === 'number' && exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function bearerToken(request) {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

async function handleLogin(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const expected = env.ADMIN_PASSWORD;
  if (!expected) {
    // Fail closed. A missing secret must never mean "let everyone in".
    return json({ error: 'not_configured' }, 503);
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rlKey = `rl:login:${ip}`;
  if (env.STORE) {
    const attempts = Number(await env.STORE.get(rlKey)) || 0;
    if (attempts >= LOGIN_MAX_ATTEMPTS) return json({ error: 'too_many_attempts' }, 429);
  }

  let supplied = '';
  try {
    const body = await request.json();
    supplied = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  // Flat delay on every attempt, right or wrong, so response time says
  // nothing — the KV counter above handles volume.
  await new Promise(r => setTimeout(r, 400));

  if (!timingSafeEqual(supplied, expected)) {
    if (env.STORE) {
      const attempts = Number(await env.STORE.get(rlKey)) || 0;
      await env.STORE.put(rlKey, String(attempts + 1), { expirationTtl: LOGIN_WINDOW_SECONDS });
    }
    return json({ error: 'bad_password' }, 401);
  }

  if (env.STORE) await env.STORE.delete(rlKey);

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await sign(
    b64url(new TextEncoder().encode(JSON.stringify({ exp }))),
    env.ADMIN_TOKEN_SECRET || expected
  );
  return json({ ok: true, token, exp });
}

/** The stored envelope, or null when KV is unbound, empty, or unreadable. */
async function getEnvelope(env) {
  if (!env.STORE) return null;
  try {
    const env1 = await env.STORE.get(DATA_KEY, 'json');
    return env1 && typeof env1 === 'object' && env1.schema <= SCHEMA ? env1 : null;
  } catch {
    return null;
  }
}

async function handleGetData(env) {
  if (!env.STORE) return json({ error: 'no_store' }, 404);
  const envelope = await getEnvelope(env);
  return envelope ? json(envelope) : json({ error: 'no_data' }, 404);
}

async function handlePutData(request, env) {
  if (!env.STORE) return json({ error: 'no_store' }, 404);
  if (!(await verifyToken(bearerToken(request), env))) return json({ error: 'bad_token' }, 401);

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);

  let data;
  try { data = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }

  /* Shape check mirrors what normalizeData() requires client-side. Content
     stays plain text — the page escapes at render time; the job here is only
     to refuse blobs the site cannot boot from. */
  if (!data || typeof data !== 'object' ||
      !Array.isArray(data.products) || !Array.isArray(data.cats) ||
      typeof data.settings !== 'object' || data.settings === null) {
    return json({ error: 'bad_shape' }, 400);
  }
  /* Old backups may still carry the legacy plaintext password — never store it. */
  delete data.settings.pw;

  const envelope = {
    schema: SCHEMA,
    updatedAt: new Date().toISOString(),
    data: { settings: data.settings, slides: data.slides, cats: data.cats,
            products: data.products, reviews: data.reviews },
  };

  const prev = await env.STORE.get(DATA_KEY);
  if (prev) await env.STORE.put(PREV_KEY, prev);
  await env.STORE.put(DATA_KEY, JSON.stringify(envelope));
  return json({ ok: true, updatedAt: envelope.updatedAt });
}

async function handleUpload(request, env) {
  if (!env.STORE) return json({ error: 'no_store' }, 404);
  if (!(await verifyToken(bearerToken(request), env))) return json({ error: 'bad_token' }, 401);

  const ct = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!IMAGE_TYPES.includes(ct)) return json({ error: 'bad_type' }, 415);

  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return json({ error: 'empty' }, 400);
  if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: 'too_large' }, 413);

  const id = crypto.randomUUID().replace(/-/g, '');
  await env.STORE.put(IMG_PREFIX + id, bytes, { metadata: { ct } });
  return json({ ok: true, url: `/img/${id}` });
}

async function serveImage(env, id) {
  if (!env.STORE) return new Response('not found', { status: 404 });
  const { value, metadata } = await env.STORE.getWithMetadata(IMG_PREFIX + id, 'arrayBuffer');
  if (!value) return new Response('not found', { status: 404 });
  return new Response(value, {
    headers: {
      'content-type': metadata?.ct || 'application/octet-stream',
      // the id changes on every upload, so the bytes behind it never do
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

/* "</script>" inside a JSON string would end the data block early; < is
   the same character to JSON.parse and invisible to the HTML parser. */
const jsonForScript = s => s.replace(/</g, '\\u003c');

/** Drop every `undefined` so optional fields simply vanish from the JSON-LD. */
const compactLd = o => JSON.parse(JSON.stringify(o));

const absUrl = (origin, path) =>
  !path ? '' : /^https?:\/\//.test(path) ? path : origin + '/' + String(path).replace(/^\//, '');

/* Mirrors the static #ld-business block in index.html, rebuilt from the
   published settings so an edited phone number or address propagates. */
function businessJsonLd(s = {}, origin) {
  const parts = String(s.addr || '').split(',');
  return compactLd({
    '@context': 'https://schema.org',
    '@type': 'ElectronicsStore',
    name: s.name || 'Phone Store',
    url: origin + '/',
    telephone: s.telShow || undefined,
    email: s.mail || undefined,
    address: s.addr ? {
      '@type': 'PostalAddress',
      streetAddress: parts[0].trim(),
      addressLocality: (parts[1] || '').trim() || undefined,
      addressCountry: 'IL',
    } : undefined,
  });
}

/* Product + Offer only. The site's reviews are store-level, so no
   AggregateRating here — attaching them per-product would violate
   Google's structured-data rules. */
function productJsonLd(p, settings, canonical, image) {
  return compactLd({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.desc || undefined,
    image: image ? [image] : undefined,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    offers: {
      '@type': 'Offer',
      price: String(p.price ?? ''),
      priceCurrency: 'ILS',
      availability: 'https://schema.org/InStock',
      url: canonical,
      seller: { '@type': 'Organization', name: settings?.name || 'Phone Store' },
    },
  });
}

/**
 * The homepage asset with the published content injected into the inert
 * <script id="server-data"> block, so the page boots on live data with no
 * second round trip and no content pop. For /product/:id the same page is
 * served with per-product title/description/OG/canonical and Product
 * JSON-LD, and the front-end opens the matching modal on load.
 *
 * Nothing published yet → the untouched asset: the page boots on its
 * built-in DEFAULTS, and a /product/:id link still opens client-side.
 */
async function serveInjectedPage(request, env, url, productId) {
  const envelope = await getEnvelope(env);
  const p = envelope && productId
    ? (envelope.data?.products || []).find(x => x && x.id === productId)
    : null;
  /* With published data, a dead product URL is a real 404-equivalent:
     send humans home and let search engines drop the link. */
  if (envelope && productId && !p) return Response.redirect(new URL('/', url), 302);

  // Always the homepage asset, whatever path was requested.
  const res = await env.ASSETS.fetch(new Request(new URL('/', url), request));
  if (!envelope) return res;

  const data = envelope.data || {};
  const rw = new HTMLRewriter()
    .on('script#server-data', {
      element(el) {
        el.setInnerContent(jsonForScript(JSON.stringify(envelope)), { html: true });
      },
    })
    .on('script#ld-business', {
      element(el) {
        el.setInnerContent(
          jsonForScript(JSON.stringify(businessJsonLd(data.settings, url.origin))), { html: true });
      },
    });

  if (p) {
    const storeName = data.settings?.name || 'Phone Store';
    const title = `${p.name} · ${storeName}`;
    const desc = String(p.desc || `${p.name} — ${storeName}`).slice(0, 155);
    const canonical = `${url.origin}/product/${p.id}`;
    const image = absUrl(url.origin, p.img);
    const set = attr => ({ element(el) { el.setAttribute('content', attr); } });
    rw.on('title', { element(el) { el.setInnerContent(title); } })
      .on('meta[name="description"]', set(desc))
      .on('meta[property="og:title"]', set(title))
      .on('meta[property="og:description"]', set(desc))
      .on('meta[property="og:type"]', set('product'))
      .on('meta[property="og:url"]', set(canonical))
      .on('link[rel="canonical"]', { element(el) { el.setAttribute('href', canonical); } });
    if (image) rw.on('meta[property="og:image"]', set(image));
    rw.on('head', {
      element(el) {
        el.append(
          `<script type="application/ld+json">${
            jsonForScript(JSON.stringify(productJsonLd(p, data.settings, canonical, image)))
          }</script>`, { html: true });
      },
    });
  }

  return rw.transform(res);
}

function sitemapXml(origin, envelope) {
  const lastmod = envelope?.updatedAt
    ? `<lastmod>${envelope.updatedAt.slice(0, 10)}</lastmod>` : '';
  const urls = [`<url><loc>${origin}/</loc>${lastmod}</url>`];
  for (const p of envelope?.data?.products || []) {
    /* the id doubles as a path segment — list only ids that are safe as one */
    if (p && /^[\w-]{1,40}$/.test(p.id)) {
      urls.push(`<url><loc>${origin}/product/${p.id}</loc>${lastmod}</url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/admin/login') return handleLogin(request, env);

    if (url.pathname === '/api/upload') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return handleUpload(request, env);
    }

    const img = url.pathname.match(/^\/img\/([0-9a-f]{32})$/);
    if (img) return serveImage(env, img[1]);

    if (url.pathname === '/api/data') {
      if (request.method === 'GET') return handleGetData(env);
      if (request.method === 'PUT') return handlePutData(request, env);
      return json({ error: 'method_not_allowed' }, 405);
    }

    if (url.pathname === '/') return serveInjectedPage(request, env, url);

    const product = url.pathname.match(/^\/product\/([\w-]{1,40})$/);
    if (product) return serveInjectedPage(request, env, url, product[1]);

    if (url.pathname === '/sitemap.xml') {
      return new Response(sitemapXml(url.origin, await getEnvelope(env)), {
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    if (url.pathname === '/robots.txt') {
      return new Response(
        `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${url.origin}/sitemap.xml\n`, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        });
    }

    // Everything else is the static site.
    return env.ASSETS.fetch(request);
  },
};
