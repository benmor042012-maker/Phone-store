/**
 * The Worker gives every page one address and every missing page a real status.
 * The www host is redirected before anything else runs, and an unknown path keeps the
 * document the SPA renders its not-found page from, with a 404 instead of the CDN's 200.
 */
import { describe, expect, it } from "vitest";
import worker, { canonicalRedirect, statusForDocument } from "../cloudflare/worker";

function envWith(document = new Response("<html>static</html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })) {
  const fetched: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (input: Request) => {
        const url = new URL(input.url);
        fetched.push(url.pathname);
        if (url.pathname === "/catalog.json") return new Response("{}", { status: 404 });
        if (url.pathname.endsWith(".png")) return new Response("png", { status: 200, headers: { "content-type": "image/png" } });
        return document.clone();
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

describe("statusForDocument", () => {
  it("is 200 for every route the app renders and 404 for the rest", () => {
    for (const path of ["/", "/products/33767", "/admin", "/404", "/repairs", "/iphone", "/accessories", "/about"]) expect(statusForDocument(path), path).toBe(200);
    for (const path of ["/nope", "/products", "/repairs/extra", "/index"]) expect(statusForDocument(path), path).toBe(404);
  });
});

describe("worker document status", () => {
  it("returns the document with a 404 for an unknown path", async () => {
    const { env } = envWith();
    const response = await worker.fetch(new Request("https://shop.example/nope"), env, {} as never);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe("<html>static</html>");
  });

  it("keeps a 200 for the pages that exist", async () => {
    for (const path of ["/", "/repairs", "/about", "/products/1"]) {
      const { env } = envWith();
      const response = await worker.fetch(new Request(`https://shop.example${path}`), env, {} as never);
      expect(response.status, path).toBe(200);
    }
  });

  it("never changes the status of a non-HTML asset or of a non-200 answer", async () => {
    const { env } = envWith();
    expect((await worker.fetch(new Request("https://shop.example/images/missing.png"), env, {} as never)).status).toBe(200);
    const redirecting = envWith(new Response(null, { status: 308, headers: { location: "/", "content-type": "text/html" } }));
    expect((await worker.fetch(new Request("https://shop.example/index.html"), redirecting.env, {} as never)).status).toBe(308);
  });
});
