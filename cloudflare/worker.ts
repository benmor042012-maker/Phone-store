import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../server/routers";

export interface Env {
  ASSETS: Fetcher;
}

const endpoint = "/api/trpc";

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

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
