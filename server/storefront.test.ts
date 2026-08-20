/** Tests for the read-only source storefront adapter. */
import { describe, expect, it } from "vitest";
import { isPublishableSourceData, loginToSourceAdmin, normalizeStorefrontPayload, publishToSourceAdmin, sourceAssetUrl, uploadToSourceAdmin } from "./storefront";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("normalizeStorefrontPayload", () => {
  it("keeps catalog content and does not create reviews that were not supplied by the source", () => {
    const data = normalizeStorefrontPayload({
      updatedAt: "2026-08-19T00:00:00.000Z",
      data: { settings: { name: "Phone Store", ship: 299, pay36: 36 }, categories: [{ id: "c1", name: "טלפונים" }], products: [{ id: "p1", name: "Phone", brand: "Apple", cat: "c1", price: 100, specs: { מסך: "6.1" } }], slides: [{ id: "s1", title: "כותרת", accent: "הדגשה", lead: "טקסט" }], reviews: [{ text: "ignored" }] },
    });
    expect(data.products).toHaveLength(1);
    expect(data.products[0]).toMatchObject({ id: "p1", price: 100, specs: { מסך: "6.1" } });
    expect(data.reviews).toEqual([{ id: "", name: "", when: "", stars: 0, text: "" }].filter((review) => review.id));
    expect(sourceAssetUrl("assets/products/p1.webp", "fallback.webp")).toContain("/assets/products/p1.webp");
  });
});

describe("storefront sourceData", () => {
  it("returns an unavailable state instead of failing when the source API is down", async () => {
    const savedFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("source unavailable", { status: 503 });
    const caller = appRouter.createCaller({ user: null, req: {}, res: {} } as TrpcContext);
    try {
      await expect(caller.storefront.sourceData()).resolves.toEqual({ status: "unavailable", data: null });
    } finally {
      globalThis.fetch = savedFetch;
    }
  });
});

describe("source administrator proxy", () => {
  it("forwards a password only to the source login endpoint and returns its short-lived session", async () => {
    const fetchMock: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("/api/admin/login");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ password: "secret" }));
      return new Response(JSON.stringify({ token: "a".repeat(32), exp: 1_800_000_000 }), { status: 200, headers: { "content-type": "application/json" } });
    };
    await expect(loginToSourceAdmin("secret", fetchMock)).resolves.toEqual({ token: "a".repeat(32), exp: 1_800_000_000 });
  });

  it("accepts a complete source payload and sends a publication only with a source-issued token", async () => {
    const payload = { settings: { name: "Phone Store" }, slides: [], cats: [], products: [], reviews: [] };
    expect(isPublishableSourceData(payload)).toBe(true);
    const fetchMock: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("/api/data");
      expect(init?.method).toBe("PUT");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer source-token");
      return new Response(JSON.stringify({ ok: true, updatedAt: "2026-08-19T00:00:00.000Z" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    await expect(publishToSourceAdmin("source-token", payload, fetchMock)).resolves.toEqual({ updatedAt: "2026-08-19T00:00:00.000Z" });
  });

  it("forwards an image only to the source upload endpoint with the temporary source token", async () => {
    const fetchMock: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("/api/upload");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer source-token");
      return new Response(JSON.stringify({ ok: true, url: "/img/new-image" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    await expect(uploadToSourceAdmin("source-token", "image/webp", "aGVsbG8=", fetchMock)).resolves.toEqual({ url: "https://phone-store.ben-mor-04-2012.workers.dev/img/new-image" });
  });
});
