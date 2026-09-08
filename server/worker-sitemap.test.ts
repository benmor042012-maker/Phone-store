/** The worker serves a generated sitemap from the shipped catalog and falls back to static assets otherwise. */
import { describe, expect, it } from "vitest";
import worker from "../cloudflare/worker";

function envWith(catalog: Response | (() => Response)) {
  return {
    ASSETS: {
      fetch: async (input: Request) => {
        const url = new URL(input.url);
        if (url.pathname === "/catalog.json") return typeof catalog === "function" ? catalog() : catalog;
        return new Response(`static:${url.pathname}`, { status: 200 });
      },
    },
  } as unknown as Parameters<typeof worker.fetch>[1];
}

describe("worker sitemap route", () => {
  it("builds the sitemap from catalog.json with the request origin", async () => {
    const env = envWith(new Response(JSON.stringify({ capturedAt: "2026-08-21T09:51:17.911Z", products: [{ id: "33767", image: "/images/catalog/a.webp" }] }), { headers: { "content-type": "application/json" } }));
    const response = await worker.fetch(new Request("https://shop.example/sitemap.xml"), env, {} as never);
    expect(response.headers.get("content-type")).toContain("application/xml");
    const xml = await response.text();
    expect(xml).toContain("<loc>https://shop.example/</loc>");
    expect(xml).toContain("<loc>https://shop.example/products/33767</loc>");
  });

  it("falls back to the static asset when the catalog cannot be read", async () => {
    const env = envWith(new Response("missing", { status: 404 }));
    const response = await worker.fetch(new Request("https://shop.example/sitemap.xml"), env, {} as never);
    expect(await response.text()).toBe("static:/sitemap.xml");
    const other = await worker.fetch(new Request("https://shop.example/robots.txt"), env, {} as never);
    expect(await other.text()).toBe("static:/robots.txt");
  });
});
