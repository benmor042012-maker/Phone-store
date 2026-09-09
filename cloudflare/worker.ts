import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { buildProductSocialMeta, findProduct, productIdFromPath, type SocialCatalog } from "../server/social-meta";
import { appRouter } from "../server/routers";
import { buildSitemapXml, type SitemapCatalog } from "../server/sitemap";
import { rewriteSocialHead } from "./social-head";

export interface Env {
  ASSETS: Fetcher;
}

const endpoint = "/api/trpc";

/** Lists every product page from the shipped catalog; falls back to the static sitemap asset when the catalog is unreadable. */
async function buildSitemapResponse(origin: string, env: Env, request: Request): Promise<Response | null> {
  try {
    const catalogResponse = await env.ASSETS.fetch(new Request(new URL("/catalog.json", request.url), { headers: { Accept: "application/json" } }));
    if (!catalogResponse.ok) return null;
    const catalog = (await catalogResponse.json()) as SitemapCatalog;
    return new Response(buildSitemapXml(origin, catalog), {
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
    const product = catalog && findProduct(catalog, id);
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
        }) as never,
        onError({ error, path }) {
          console.error(`[tRPC] ${path ?? "unknown"}: ${error.message}`);
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
