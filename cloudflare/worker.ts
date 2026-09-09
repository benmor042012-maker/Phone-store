import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { readImage, readOverrides, type AdminEnv } from "../server/admin-store";
import { applyOverrides, type CatalogProduct } from "@shared/catalog-overrides";
import { buildProductSocialMeta, findProduct, productIdFromPath, type SocialCatalog } from "../server/social-meta";
import { appRouter } from "../server/routers";
import { buildSitemapXml, type SitemapCatalog } from "../server/sitemap";
import { rewriteSocialHead } from "./social-head";

export interface Env extends AdminEnv {
  ASSETS: Fetcher;
}

const endpoint = "/api/trpc";

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
    return rewriteSocialHead(document, buildProductSocialMeta(url.origin, product));
  } catch (error) {
    console.error(`[social-head] ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
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

    // Photos the admin uploaded live in KV, not in the asset bundle.
    const image = /^\/img\/([^/]+)$/.exec(url.pathname);
    if (image) {
      const stored = await readImage(env, image[1]);
      if (!stored) return new Response("not found", { status: 404 });
      return new Response(stored.body, {
        headers: {
          "content-type": stored.contentType,
          // The id changes on every upload, so the bytes behind it never do.
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (url.pathname === "/sitemap.xml") {
      const sitemap = await buildSitemapResponse(url.origin, env, request);
      if (sitemap) return sitemap;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const product = await productDocument(url, env, request);
      if (product) return product;
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
