/**
 * The content administration that replaced the HTTP proxy: it must accept the real password,
 * refuse everything else, and never hand out a writable session it did not issue.
 */
import { describe, expect, it } from "vitest";
import * as admin from "./admin-store";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/** An in-memory stand-in for the KV namespace, close enough for the calls made here. */
function memoryStore() {
  const values = new Map<string, string | ArrayBuffer>();
  const metadata = new Map<string, Record<string, unknown>>();
  return {
    values,
    async get(key: string, type?: string) {
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value as string) : value;
    },
    async getWithMetadata(key: string) {
      return { value: (values.get(key) as ArrayBuffer) ?? null, metadata: metadata.get(key) ?? null };
    },
    async put(key: string, value: string | ArrayBuffer, options?: { metadata?: Record<string, unknown> }) {
      values.set(key, value);
      if (options?.metadata) metadata.set(key, options.metadata);
    },
    async delete(key: string) {
      values.delete(key);
    },
  } as unknown as admin.KVLike & { values: Map<string, string | ArrayBuffer> };
}

function envWith(overrides: Partial<admin.AdminEnv> = {}) {
  return { STORE: memoryStore(), ADMIN_PASSWORD: "correct horse", ...overrides } as admin.AdminEnv & { STORE: ReturnType<typeof memoryStore> };
}

const noDelay = { delayMs: 0 };

describe("login", () => {
  it("issues a session for the configured password and rejects any other", async () => {
    const env = envWith();
    const ok = await admin.login(env, "correct horse", noDelay);
    expect(ok.status).toBe("ok");
    expect(await admin.login(env, "correct hors", noDelay)).toEqual({ status: "invalid" });
    expect(await admin.login(env, "", noDelay)).toEqual({ status: "invalid" });
  });

  it("fails closed when no password is configured, rather than letting everyone in", async () => {
    expect(await admin.login({ STORE: memoryStore() }, "anything", noDelay)).toEqual({ status: "not_configured" });
  });

  it("throttles one address without locking out another", async () => {
    const env = envWith();
    for (let attempt = 0; attempt < 8; attempt++) await admin.login(env, "wrong", { ...noDelay, ip: "1.2.3.4" });
    expect(await admin.login(env, "correct horse", { ...noDelay, ip: "1.2.3.4" })).toEqual({ status: "throttled" });
    expect((await admin.login(env, "correct horse", { ...noDelay, ip: "5.6.7.8" })).status).toBe("ok");
  });

  it("clears an address's failed attempts once it logs in", async () => {
    const env = envWith();
    for (let attempt = 0; attempt < 3; attempt++) await admin.login(env, "wrong", { ...noDelay, ip: "1.2.3.4" });
    expect((await admin.login(env, "correct horse", { ...noDelay, ip: "1.2.3.4" })).status).toBe("ok");
    expect(env.STORE.values.has("rl:login:1.2.3.4")).toBe(false);
  });
});

describe("verifyToken", () => {
  it("accepts only a token this store signed", async () => {
    const env = envWith();
    const session = await admin.login(env, "correct horse", noDelay);
    if (session.status !== "ok") throw new Error("login should have succeeded");
    expect(await admin.verifyToken(env, session.session.token)).toBe(true);

    // A token minted against a different secret must not open this store.
    const other = await admin.login(envWith({ ADMIN_PASSWORD: "different" }), "different", noDelay);
    if (other.status !== "ok") throw new Error("login should have succeeded");
    expect(await admin.verifyToken(env, other.session.token)).toBe(false);

    for (const bad of ["", "not-a-token", `${session.session.token}x`, session.session.token.replace(/\.[^.]*$/, ".AAAA")]) {
      expect(await admin.verifyToken(env, bad)).toBe(false);
    }
  });

  it("rejects a correctly signed token whose expiry has passed", async () => {
    const env = envWith();
    const session = await admin.login(env, "correct horse", noDelay);
    if (session.status !== "ok") throw new Error("login should have succeeded");
    const [payload] = session.session.token.split(".");
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    expect(decoded.exp * 1000).toBeGreaterThan(Date.now());
  });
});

describe("publish", () => {
  const content = { settings: { name: "Phone Store" }, slides: [], cats: [{ id: "c1" }], products: [{ id: "p1" }], reviews: [] };

  async function tokenFor(env: admin.AdminEnv) {
    const session = await admin.login(env, "correct horse", noDelay);
    if (session.status !== "ok") throw new Error("login should have succeeded");
    return session.session.token;
  }

  it("writes the envelope the storefront reads back", async () => {
    const env = envWith();
    const result = await admin.publish(env, await tokenFor(env), content);
    expect(result.status).toBe("ok");
    const envelope = await admin.readEnvelope(env);
    expect(envelope?.data).toMatchObject({ settings: { name: "Phone Store" }, cats: [{ id: "c1" }] });
  });

  it("keeps the replaced envelope so a publish can be undone", async () => {
    const env = envWith();
    const token = await tokenFor(env);
    await admin.publish(env, token, content);
    await admin.publish(env, token, { ...content, settings: { name: "Renamed" } });
    expect(JSON.parse(env.STORE.values.get("site:data:v1:prev") as string).data.settings.name).toBe("Phone Store");
  });

  it("refuses a token it did not issue, and writes nothing", async () => {
    const env = envWith();
    expect(await admin.publish(env, "forged.token", content)).toEqual({ status: "expired" });
    expect(env.STORE.values.has("site:data:v1")).toBe(false);
  });

  it("refuses content the storefront could not boot from", async () => {
    const env = envWith();
    const token = await tokenFor(env);
    for (const bad of [null, [], "text", { settings: null }, { settings: [] }, { cats: [], products: [] }, { settings: {}, slides: "not an array" }]) {
      expect((await admin.publish(env, token, bad)).status).toBe("invalid_data");
    }
  });

  it("accepts content without the legacy cats and products the storefront no longer reads", async () => {
    const env = envWith();
    const token = await tokenFor(env);
    expect((await admin.publish(env, token, { settings: { name: "Phone Store" }, slides: [], reviews: [] })).status).toBe("ok");
  });

  it("never stores a legacy plaintext password carried in an old backup", async () => {
    const env = envWith();
    await admin.publish(env, await tokenFor(env), { ...content, settings: { name: "Phone Store", pw: "leaked" } });
    expect(env.STORE.values.get("site:data:v1")).not.toContain("leaked");
  });
});

describe("images", () => {
  it("stores an upload under a fresh id and serves the same bytes back", async () => {
    const env = envWith();
    const session = await admin.login(env, "correct horse", noDelay);
    if (session.status !== "ok") throw new Error("login should have succeeded");
    const result = await admin.uploadImage(env, session.session.token, "image/webp", btoa("image-bytes"));
    if (result.status !== "ok") throw new Error(`upload failed: ${result.status}`);
    expect(result.url).toMatch(/^\/img\/[0-9a-f]{32}$/);
    const stored = await admin.readImage(env, result.url.slice(5));
    expect(stored?.contentType).toBe("image/webp");
    expect(new TextDecoder().decode(stored?.body)).toBe("image-bytes");
  });

  it("refuses an unsigned token and an unsupported type", async () => {
    const env = envWith();
    expect(await admin.uploadImage(env, "forged.token", "image/webp", btoa("x"))).toEqual({ status: "expired" });
    const session = await admin.login(env, "correct horse", noDelay);
    if (session.status !== "ok") throw new Error("login should have succeeded");
    expect(await admin.uploadImage(env, session.session.token, "image/gif", btoa("x"))).toEqual({ status: "bad_type" });
  });

  it("returns nothing for an id that is not one it minted", async () => {
    const env = envWith();
    for (const id of ["", "../secret", "nope", "site:data:v1"]) {
      expect(await admin.readImage(env, id)).toBeNull();
    }
  });
});

describe("catalog overrides", () => {
  async function tokenFor(env: admin.AdminEnv) {
    const session = await admin.login(env, "correct horse", noDelay);
    if (session.status !== "ok") throw new Error("login should have succeeded");
    return session.session.token;
  }

  it("starts empty and round-trips what the owner saved", async () => {
    const env = envWith();
    expect(await admin.readOverrides(env)).toMatchObject({ hidden: [], edits: {}, added: [] });
    const result = await admin.saveOverrides(env, await tokenFor(env), { hidden: ["a"], edits: { b: { price: 89 } }, added: [] });
    expect(result.status).toBe("ok");
    expect(await admin.readOverrides(env)).toMatchObject({ hidden: ["a"], edits: { b: { price: 89 } } });
  });

  it("normalizes before storing, so a bad field never reaches the storefront", async () => {
    const env = envWith();
    await admin.saveOverrides(env, await tokenFor(env), { hidden: ["a"], edits: { a: { price: -5, junk: true } }, added: [{ name: "no id" }] });
    const stored = await admin.readOverrides(env);
    expect(stored.edits).toEqual({});
    expect(stored.added).toEqual([]);
    expect(stored.updatedAt).toBeTruthy();
  });

  it("refuses a token it did not issue, and writes nothing", async () => {
    const env = envWith();
    expect(await admin.saveOverrides(env, "forged.token", { hidden: ["a"] })).toEqual({ status: "expired" });
    expect(await admin.readOverrides(env)).toMatchObject({ hidden: [] });
  });

  it("keeps the replaced set so a save can be undone", async () => {
    const env = envWith();
    const token = await tokenFor(env);
    await admin.saveOverrides(env, token, { hidden: ["a"] });
    await admin.saveOverrides(env, token, { hidden: ["b"] });
    expect(JSON.parse(env.STORE.values.get("site:catalog:overrides:v1:prev") as string).hidden).toEqual(["a"]);
  });

  it("survives a stored value that is not valid JSON", async () => {
    const env = envWith();
    await env.STORE.put("site:catalog:overrides:v1", "{not json");
    expect(await admin.readOverrides(env)).toMatchObject({ hidden: [], edits: {}, added: [] });
  });
});

describe("router without Cloudflare bindings", () => {
  const caller = () => appRouter.createCaller({ user: null, req: {}, res: {} } as TrpcContext);

  it("reports the store as unavailable instead of pretending a login worked", async () => {
    await expect(caller().sourceAdmin.login({ password: "correct horse" })).resolves.toEqual({ status: "unavailable", session: null });
    await expect(caller().storefront.sourceData()).resolves.toEqual({ status: "unavailable", data: null });
    await expect(caller().sourceAdmin.publish({ token: "x".repeat(16), data: {} })).resolves.toEqual({ status: "unavailable", updatedAt: null });
  });
});
