import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../server/routers";
import { buildSitemapXml, type SitemapCatalog } from "../server/sitemap";

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

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
