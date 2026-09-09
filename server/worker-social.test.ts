/**
 * The worker only takes over a product document when it can build a better preview card.
 * Every other path, and every failure, must fall through to the asset exactly as before.
 *
 * The rewrite itself runs on HTMLRewriter, which only exists inside workerd, so it is
 * covered by `pnpm check:preview` against `wrangler dev` rather than here.
 */
import { describe, expect, it, vi } from "vitest";
import worker from "../cloudflare/worker";

const catalog = { products: [{ id: "33767", name: "כיסוי רינג", price: 149, image: "/images/catalog/a.webp" }] };

function envWith(overrides: { catalog?: Response | (() => Response); document?: Response } = {}) {
  const fetched: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (input: Request) => {
        const url = new URL(input.url);
        fetched.push(url.pathname);
        if (url.pathname === "/catalog.json") {
          const value = overrides.catalog ?? new Response(JSON.stringify(catalog), { headers: { "content-type": "application/json" } });
          return typeof value === "function" ? value() : value;
        }
        return overrides.document ?? new Response(`static:${url.pathname}`, { status: 200 });
      },
    },
  } as unknown as Parameters<typeof worker.fetch>[1];
  return { env, fetched };
}

describe("worker product preview", () => {
  it("never reads the catalog for a path that is not a product", async () => {
    for (const path of ["/", "/admin", "/images/logo.png"]) {
      const { env, fetched } = envWith();
      const response = await worker.fetch(new Request(`https://shop.example${path}`), env, {} as never);
      expect(await response.text()).toBe(`static:${path}`);
      expect(fetched).not.toContain("/catalog.json");
    }
  });

  it("serves the untouched document when the product is not in the catalog", async () => {
    const { env } = envWith();
    const response = await worker.fetch(new Request("https://shop.example/products/999999"), env, {} as never);
    expect(await response.text()).toBe("static:/products/999999");
  });

  it("serves the untouched document when the catalog cannot be read or parsed", async () => {
    for (const bad of [new Response("nope", { status: 404 }), new Response("{not json", { headers: { "content-type": "application/json" } })]) {
      const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { env } = envWith({ catalog: bad });
      const response = await worker.fetch(new Request("https://shop.example/products/33767"), env, {} as never);
      expect(await response.text()).toBe("static:/products/33767");
      errors.mockRestore();
    }
  });

  it("leaves a non-HTML response alone even on a product path", async () => {
    const { env } = envWith({ document: new Response("{}", { status: 200, headers: { "content-type": "application/json" } }) });
    const response = await worker.fetch(new Request("https://shop.example/products/33767"), env, {} as never);
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("still routes the API and the sitemap ahead of the product handler", async () => {
    const { env, fetched } = envWith();
    const sitemap = await worker.fetch(new Request("https://shop.example/sitemap.xml"), env, {} as never);
    expect(sitemap.headers.get("content-type")).toContain("application/xml");
    expect(fetched).not.toContain("/products/33767");
  });
});
