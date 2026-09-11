/** Public tRPC contract for the storefront and its content administration. */
import { COOKIE_NAME } from "@shared/const";
import * as admin from "./admin-store";
import { EMPTY_OVERRIDES } from "@shared/catalog-overrides";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { normalizeStorefrontPayload } from "./storefront";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  storefront: router({
    // Public: the browser merges these into the shipped catalog before rendering.
    catalogOverrides: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.env) return EMPTY_OVERRIDES;
      try {
        return await admin.readOverrides(ctx.env);
      } catch (error) {
        console.warn("[catalog] Overrides could not be read", error);
        return EMPTY_OVERRIDES;
      }
    }),
    sourceData: publicProcedure.query(async ({ ctx }) => {
      try {
        const envelope = ctx.env ? await admin.readEnvelope(ctx.env) : null;
        if (!envelope) return { status: "unavailable" as const, data: null };
        return { status: "live" as const, data: normalizeStorefrontPayload(envelope) };
      } catch (error) {
        console.warn("[storefront] Published content could not be read", error);
        return { status: "unavailable" as const, data: null };
      }
    }),
  }),
  sourceAdmin: router({
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      if (!ctx.env) return { status: "unavailable" as const, session: null };
      const result = await admin.login(ctx.env, input.password, { ip: ctx.ip });
      if (result.status === "ok") return { status: "ok" as const, session: result.session };
      if (result.status === "invalid") return { status: "invalid" as const, session: null };
      // A missing ADMIN_PASSWORD secret and a throttled address are both operator-visible
      // states, not a wrong password, so they must not read as one.
      console.warn(`[admin] Login unavailable: ${result.status}`);
      return { status: result.status, session: null };
    }),
    load: publicProcedure.input(z.object({ token: z.string().min(16).max(4096) })).query(async ({ ctx, input }) => {
      if (!ctx.env) return { status: "unavailable" as const, data: null };
      if (!(await admin.verifyToken(ctx.env, input.token))) return { status: "expired" as const, data: null };
      const envelope = await admin.readEnvelope(ctx.env);
      // No envelope yet is a first-run store, not a failure: hand back an empty draft.
      return { status: "ok" as const, data: envelope?.data ?? null };
    }),
    publish: publicProcedure.input(z.object({ token: z.string().min(16).max(4096), data: z.unknown() })).mutation(async ({ ctx, input }) => {
      if (!ctx.env) return { status: "unavailable" as const, updatedAt: null };
      const result = await admin.publish(ctx.env, input.token, input.data);
      if (result.status === "ok") return { status: "ok" as const, updatedAt: result.updatedAt };
      if (result.status === "no_store") console.warn("[admin] Publish attempted with no content store bound");
      return { status: result.status, updatedAt: null };
    }),
    saveCatalog: publicProcedure.input(z.object({ token: z.string().min(16).max(4096), overrides: z.unknown() })).mutation(async ({ ctx, input }) => {
      if (!ctx.env) return { status: "unavailable" as const, updatedAt: null };
      const result = await admin.saveOverrides(ctx.env, input.token, input.overrides);
      if (result.status === "ok") return { status: "ok" as const, updatedAt: result.updatedAt };
      return { status: result.status, updatedAt: null };
    }),
    // Photos and short clips share one store, one URL shape and one library listing.
    upload: publicProcedure.input(z.object({
      token: z.string().min(16).max(4096),
      contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]),
      imageBase64: z.string().min(8).max(17_000_000),
      name: z.string().max(120).optional(),
    })).mutation(async ({ ctx, input }) => {
      if (!ctx.env) return { status: "unavailable" as const, url: null, item: null };
      const result = await admin.uploadMedia(ctx.env, input.token, input.contentType, input.imageBase64, input.name ?? "");
      if (result.status === "ok") return { status: "ok" as const, url: result.url, item: result.item };
      return { status: result.status, url: null, item: null };
    }),
    // What the owner has already uploaded, so the panel can show it instead of losing it.
    media: publicProcedure.input(z.object({ token: z.string().min(16).max(4096) })).query(async ({ ctx, input }) => {
      if (!ctx.env) return { status: "unavailable" as const, items: [] };
      const result = await admin.listMedia(ctx.env, input.token);
      if (result.status === "ok") return { status: "ok" as const, items: result.items };
      return { status: result.status, items: [] };
    }),
    deleteMedia: publicProcedure.input(z.object({ token: z.string().min(16).max(4096), id: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      if (!ctx.env) return { status: "unavailable" as const };
      return { status: (await admin.deleteMedia(ctx.env, input.token, input.id)).status };
    }),
  }),
});

export type AppRouter = typeof appRouter;
