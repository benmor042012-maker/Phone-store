import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { readImage, readOverrides, type AdminEnv } from "../server/admin-store";
import { findStaticPage, isAppRoute } from "../shared/pages";
import { applyOverrides, type CatalogProduct } from "@shared/catalog-overrides";
import { buildProductSocialMeta, findProduct, productIdFromPath, type SocialCatalog } from "../server/social-meta";
import { appRouter } from "../server/routers";
import { buildSitemapXml, type SitemapCatalog } from "../server/sitemap";
import { buildProductBodyHtml } from "../server/product-page";
import { buildBreadcrumbJsonLd, buildProductJsonLd } from "../client/src/lib/seo";
import { STORE } from "../client/src/lib/storefrontState";
import { rewriteSocialHead } from "./social-head";

export interface Env extends AdminEnv {
  ASSETS: Fetcher;
}

const endpoint = "/api/trpc";

/**
 * One address per page. The site is `phonestore.co.il`; `www.` is a second host that
 * would otherwise serve a full copy, and search engines split a page's standing between
 * the two. A static page also drops a trailing slash, so `/repairs/` is `/repairs`.
 * Returns null when the URL is already the canonical one.
 */
export function canonicalRedirect(url: URL): Response | null {
  const target = new URL(url.toString());
  if (target.hostname.startsWith("www.")) target.hostname = target.hostname.slice(4);
  if (target.pathname.length > 1 && target.pathname.endsWith("/") && findStaticPage(target.pathname)) {
    target.pathname = target.pathname.replace(/\/+$/, "");
  }
  if (target.toString() === url.toString()) return null;
  return Response.redirect(target.toString(), 301);
}

/**
 * Whether a document the asset router just served is really the not-found page.
 *
 * The router answers every unmatched path with index.html and a 200, which tells a crawler
 * that `/anything` is a real page. But a file that genuinely exists — a search-engine
 * verification token, anything the owner drops into `client/public` — is served the same
 * way, and calling that a 404 breaks it. The two are told apart by the ETag: the fallback
 * carries the ETag of index.html, a real file carries its own. Without both ETags the
 * answer is "not missing", because a wrong 404 costs far more than a missed one.
 */
export function isMissingDocument(pathname: string, response: { status: number; contentType: string | null; etag: string | null }, fallbackEtag: string | null): boolean {
  if (response.status !== 200) return false;
  if (!(response.contentType ?? "").includes("text/html")) return false;
  if (isAppRoute(pathname)) return false;
  if (!response.etag || !fallbackEtag) return false;
  return response.etag === fallbackEtag;
}

/**
 * The ETag of the document the asset router hands out for a path it does not have. It is
 * index.html, so `/` names it, and it never changes for the life of a deployment — one
 * lookup per isolate. `null` means "could not tell", which keeps every document at 200.
 */
let fallbackEtag: string | null | undefined;
async function spaFallbackEtag(env: Env, request: Request): Promise<string | null> {
  if (fallbackEtag !== undefined) return fallbackEtag;
  try {
    const response = await env.ASSETS.fetch(new Request(new URL("/", request.url), { method: "GET" }));
    fallbackEtag = response.ok ? response.headers.get("etag") : null;
  } catch {
    fallbackEtag = null;
  }
  return fallbackEtag;
}

/**
 * Where a request for `<name>.html` should go.
 *
 * The asset router's own answer is a redirect to the extensionless twin, which is right
 * for the shop's own pages — one address each — and wrong for a verification token, which
 * has to answer 200 at the exact URL the search engine was given. So a page of ours
 * redirects, and any other HTML file is fetched from its clean path and served where it
 * was asked for.
 */
export function htmlFileTarget(pathname: string): { redirectTo: string } | { serveFrom: string } | null {
  const match = /^(\/.+)\.html$/.exec(pathname);
  if (!match) return null;
  const clean = match[1] === "/index" ? "/" : match[1];
  if (clean === "/" || findStaticPage(clean)) return { redirectTo: clean };
  return { serveFrom: clean };
}

/** Lists every product page from the shipped catalog; falls back to the static sitemap asset when the catalog is unreadable. */
async function buildSitemapResponse(origin: string, env: Env, request: Request): Promise<Response | null> {
  try {
    const catalogResponse = await env.ASSETS.fetch(new Request(new URL("/catalog.json", request.url), { headers: { Accept: "application/json" } }));
    if (!catalogResponse.ok) return null;
    const catalog = (await catalogResponse.json()) as SitemapCatalog;
    // A product the owner hid must not stay listed, and one they added should appear.
    const overrides = await readOverrides(env);
    const listed = applyOverrides((catalog.products ?? []) as unknown as CatalogProduct[], overrides);
    return new Response(buildSitemapXml(origin, { ...catalog, products: listed }), {
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  } catch (error) {
    console.error(`[sitemap] ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function readCatalog(env: Env, request: Request): Promise<SocialCatalog | null> {
  const response = await env.ASSETS.fetch(new Request(new URL("/catalog.json", request.url), { headers: { Accept: "application/json" } }));
  if (!response.ok) return null;
  return (await response.json()) as SocialCatalog;
}

/**
 * Serves /products/:id with that product's own preview card.
 *
 * The storefront applies its metadata from React, which link-preview crawlers never run, so
 * without this every shared product link previews as the home page. Returns null whenever
 * anything is off, and the caller falls back to the unmodified document.
 */
async function productDocument(url: URL, env: Env, request: Request): Promise<Response | null> {
  const id = productIdFromPath(url.pathname);
  if (!id) return null;
  try {
    const catalog = await readCatalog(env, request);
    if (!catalog) return null;
    // Merge the owner's changes first, so the card quotes the price the page shows and a
    // hidden product never gets a card advertising it.
    const overrides = await readOverrides(env);
    const listed = applyOverrides((catalog.products ?? []) as unknown as CatalogProduct[], overrides);
    const product = findProduct({ products: listed }, id);
    if (!product) return null;
    const document = await env.ASSETS.fetch(request);
    if (!document.ok || !(document.headers.get("content-type") ?? "").includes("text/html")) return null;
    // The shipped document carries the home page's markup, so without a body of its own
    // every product URL would be one more copy of the home page.
    const seoProduct = {
      id: product.id,
      name: product.name ?? "",
      brand: product.brand ?? "",
      category: product.category ?? "",
      price: typeof product.price === "number" ? product.price : 0,
      image: product.image ?? "",
      description: product.description ?? "",
    };
    return rewriteSocialHead(document, buildProductSocialMeta(url.origin, product), {
      html: buildProductBodyHtml(url.origin, product, { whatsapp: STORE.whatsapp, storeName: STORE.name, city: STORE.city }),
      jsonLd: [
        { id: "ld-product", data: buildProductJsonLd(url.origin, seoProduct) },
        { id: "ld-breadcrumb", data: buildBreadcrumbJsonLd(url.origin, seoProduct) },
      ],
    });
  } catch (error) {
    console.error(`[social-head] ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const redirect = canonicalRedirect(url);
    if (redirect) return redirect;
    if (url.pathname === endpoint || url.pathname.startsWith(`${endpoint}/`)) {
      return fetchRequestHandler({
        endpoint,
        req: request,
        router: appRouter,
        createContext: () => ({
          req: request,
          res: { clearCookie: () => undefined },
          user: null,
          // Content administration runs on these bindings. Handing them to the router here
          // is what keeps it from calling the site over HTTP to reach its own store.
          env,
          ip: request.headers.get("cf-connecting-ip") ?? undefined,
        }) as never,
        onError({ error, path }) {
          console.error(`[tRPC] ${path ?? "unknown"}: ${error.message}`);
        },
      });
    }

    // Photos and clips the admin uploaded live in KV, not in the asset bundle.
    const image = /^\/img\/([^/]+)$/.exec(url.pathname);
    if (image) {
      const stored = await readImage(env, image[1]);
      if (!stored) return new Response("not found", { status: 404 });
      const headers = {
        "content-type": stored.contentType,
        // The id changes on every upload, so the bytes behind it never do.
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "accept-ranges": "bytes",
      };
      // Safari on iOS will not start a video until the server answers a range request,
      // so an uploaded clip stays blank on an iPhone without this.
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
      if (range && stored.contentType.startsWith("video/")) {
        const total = stored.body.byteLength;
        const start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2] || 0));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
        if (!Number.isFinite(start) || start >= total || end < start) {
          return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${total}` } });
        }
        return new Response(stored.body.slice(start, end + 1), {
          status: 206,
          headers: { ...headers, "content-range": `bytes ${start}-${end}/${total}` },
        });
      }
      return new Response(stored.body, { headers });
    }

    if (url.pathname === "/sitemap.xml") {
      const sitemap = await buildSitemapResponse(url.origin, env, request);
      if (sitemap) return sitemap;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const product = await productDocument(url, env, request);
      if (product) return product;
    }

    // `<name>.html`: the shop's own pages keep one address, every other file is served
    // where it was asked for rather than redirected.
    const html = htmlFileTarget(url.pathname);
    let assetRequest = request;
    let servedPath = url.pathname;
    if (html) {
      if ("redirectTo" in html) {
        const target = new URL(url.toString());
        target.pathname = html.redirectTo;
        return Response.redirect(target.toString(), 301);
      }
      servedPath = html.serveFrom;
      assetRequest = new Request(new URL(`${html.serveFrom}${url.search}`, url), request);
    }

    const response = await env.ASSETS.fetch(assetRequest);
    const missing = isMissingDocument(servedPath, {
      status: response.status,
      contentType: response.headers.get("content-type"),
      etag: response.headers.get("etag"),
    }, await spaFallbackEtag(env, request));
    if (missing) return new Response(response.body, { status: 404, headers: response.headers });
    return response;
  },
} satisfies ExportedHandler<Env>;
