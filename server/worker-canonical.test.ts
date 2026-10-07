/**
 * The Worker gives every page one address and every missing page a real status.
 * The www host is redirected before anything else runs, and an unknown path keeps the
 * document the SPA renders its not-found page from, with a 404 instead of the CDN's 200.
 */
import { describe, expect, it } from "vitest";
import worker, { canonicalRedirect, htmlFileTarget, isMissingDocument } from "../cloudflare/worker";

const FALLBACK_ETAG = '"index"';

/**
 * The asset router as Cloudflare runs it: a path it has is served with that file's own
 * ETag, and a path it does not have gets index.html, with index.html's ETag.
 */
function envWith(files: Record<string, { body: string; type?: string; etag?: string }> = {}) {
  const fetched: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (input: Request) => {
        const url = new URL(input.url);
        fetched.push(url.pathname);
        if (url.pathname === "/catalog.json") return new Response("{}", { status: 404 });
        const file = files[url.pathname];
        if (file) {
          return new Response(file.body, { status: 200, headers: { "content-type": file.type ?? "text/html; charset=utf-8", etag: file.etag ?? `"${url.pathname}"` } });
        }
        // Not found: the single-page-application fallback, which is index.html.
        return new Response("<html>home</html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8", etag: FALLBACK_ETAG } });
      },
    },
  } as unknown as Parameters<typeof worker.fetch>[1];
  return { env, fetched };
}

describe("canonicalRedirect", () => {
  it("sends www to the apex host with the path and query intact", () => {
    const response = canonicalRedirect(new URL("https://www.shop.example/products/1?x=1&y=2#top"));
    expect(response?.status).toBe(301);
    expect(response?.headers.get("location")).toBe("https://shop.example/products/1?x=1&y=2#top");
  });

  it("drops a trailing slash from a landing page only", () => {
    expect(canonicalRedirect(new URL("https://shop.example/repairs/"))?.headers.get("location")).toBe("https://shop.example/repairs");
    expect(canonicalRedirect(new URL("https://shop.example/"))).toBeNull();
    expect(canonicalRedirect(new URL("https://shop.example/products/1/"))).toBeNull();
  });

  it("leaves a canonical URL alone", () => {
    expect(canonicalRedirect(new URL("https://shop.example/"))).toBeNull();
    expect(canonicalRedirect(new URL("https://shop.example/repairs?x=1"))).toBeNull();
    expect(canonicalRedirect(new URL("http://localhost:8788/admin"))).toBeNull();
  });
});

describe("worker on the www host", () => {
  it("redirects every method without touching the assets", async () => {
    for (const method of ["GET", "HEAD", "POST"]) {
      const { env, fetched } = envWith();
      const response = await worker.fetch(new Request("https://www.shop.example/api/trpc/x?y=1", { method }), env, {} as never);
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe("https://shop.example/api/trpc/x?y=1");
      expect(fetched).toEqual([]);
    }
  });
});

describe("isMissingDocument", () => {
  const fallback = { status: 200, contentType: "text/html; charset=utf-8", etag: FALLBACK_ETAG };

  it("calls a path the router had nothing for missing", () => {
    for (const path of ["/nope", "/products", "/repairs/extra"]) expect(isMissingDocument(path, fallback, FALLBACK_ETAG), path).toBe(true);
  });

  it("never calls an app route missing, even when it is the fallback document", () => {
    for (const path of ["/", "/products/33767", "/admin", "/404", "/repairs", "/repairs/screen", "/iphone", "/samsung", "/accessories", "/about"]) {
      expect(isMissingDocument(path, fallback, FALLBACK_ETAG), path).toBe(false);
    }
  });

  it("never calls a real file missing: its ETag is its own", () => {
    expect(isMissingDocument("/googled545ba7d0fc7b74d", { ...fallback, etag: '"token"' }, FALLBACK_ETAG)).toBe(false);
  });

  it("serves the document when it cannot tell, because a wrong 404 costs more", () => {
    expect(isMissingDocument("/nope", { ...fallback, etag: null }, FALLBACK_ETAG)).toBe(false);
    expect(isMissingDocument("/nope", fallback, null)).toBe(false);
  });

  it("leaves a non-HTML asset and a non-200 answer alone", () => {
    expect(isMissingDocument("/images/x.png", { status: 200, contentType: "image/png", etag: '"png"' }, FALLBACK_ETAG)).toBe(false);
    expect(isMissingDocument("/nope", { ...fallback, status: 304 }, FALLBACK_ETAG)).toBe(false);
  });
});

describe("htmlFileTarget", () => {
  it("sends the shop's own pages to their one clean address", () => {
    expect(htmlFileTarget("/repairs.html")).toEqual({ redirectTo: "/repairs" });
    expect(htmlFileTarget("/repairs/screen.html")).toEqual({ redirectTo: "/repairs/screen" });
    expect(htmlFileTarget("/index.html")).toEqual({ redirectTo: "/" });
  });

  it("serves any other HTML file from its own path, because a verification token must not redirect", () => {
    expect(htmlFileTarget("/googled545ba7d0fc7b74d.html")).toEqual({ serveFrom: "/googled545ba7d0fc7b74d" });
  });

  it("ignores a path that is not an HTML file", () => {
    for (const path of ["/", "/repairs", "/images/logo.webp", "/sitemap.xml"]) expect(htmlFileTarget(path), path).toBeNull();
  });
});

const TOKEN = "google-site-verification: googled545ba7d0fc7b74d.html";
const siteFiles = {
  "/googled545ba7d0fc7b74d": { body: TOKEN, etag: '"token"' },
  "/repairs": { body: "<html>repairs</html>", etag: '"repairs"' },
  "/images/logo.webp": { body: "webp", type: "image/webp", etag: '"logo"' },
};

describe("worker document status", () => {
  it("returns the document with a 404 for an unknown path", async () => {
    const { env } = envWith(siteFiles);
    const response = await worker.fetch(new Request("https://shop.example/nope"), env, {} as never);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe("<html>home</html>");
  });

  it("keeps a 200 for the pages that exist", async () => {
    for (const path of ["/", "/repairs", "/about", "/products/1"]) {
      const { env } = envWith(siteFiles);
      const response = await worker.fetch(new Request(`https://shop.example${path}`), env, {} as never);
      expect(response.status, path).toBe(200);
    }
  });

  it("serves a search engine's verification file at its own URL, with its own body", async () => {
    for (const path of ["/googled545ba7d0fc7b74d.html", "/googled545ba7d0fc7b74d"]) {
      const { env } = envWith(siteFiles);
      const response = await worker.fetch(new Request(`https://shop.example${path}`), env, {} as never);
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toBe(TOKEN);
    }
  });

  it("sends the shop's own .html address to the clean one", async () => {
    const { env } = envWith(siteFiles);
    const response = await worker.fetch(new Request("https://shop.example/repairs.html?x=1"), env, {} as never);
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://shop.example/repairs?x=1");
  });

  it("still reports a missing page when the name only looks like a file", async () => {
    const { env } = envWith(siteFiles);
    expect((await worker.fetch(new Request("https://shop.example/nope.html"), env, {} as never)).status).toBe(404);
  });

  it("never changes the status of a non-HTML asset", async () => {
    const { env } = envWith(siteFiles);
    expect((await worker.fetch(new Request("https://shop.example/images/logo.webp"), env, {} as never)).status).toBe(200);
  });
});
