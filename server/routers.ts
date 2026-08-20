/** Public tRPC contract for the storefront; source content is fetched read-only. */
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { isPublishableSourceData, loginToSourceAdmin, publishToSourceAdmin, readSourceAdminData, readSourceStorefront, SourceAdminError, uploadToSourceAdmin } from "./storefront";
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
    sourceData: publicProcedure.query(async () => {
      try {
        return { status: "live" as const, data: await readSourceStorefront() };
      } catch (error) {
        console.warn("[storefront] Read-only source sync unavailable", error);
        return { status: "unavailable" as const, data: null };
      }
    }),
  }),
  sourceAdmin: router({
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(256) })).mutation(async ({ input }) => {
      try {
        return { status: "ok" as const, session: await loginToSourceAdmin(input.password) };
      } catch (error) {
        if (error instanceof SourceAdminError && error.status === 401) return { status: "invalid" as const, session: null };
        console.warn("[source-admin] Login unavailable", error);
        return { status: "unavailable" as const, session: null };
      }
    }),
    load: publicProcedure.input(z.object({ token: z.string().min(16).max(4096) })).query(async () => {
      try {
        return { status: "ok" as const, data: await readSourceAdminData() };
      } catch (error) {
        console.warn("[source-admin] Data load unavailable", error);
        return { status: "unavailable" as const, data: null };
      }
    }),
    publish: publicProcedure.input(z.object({ token: z.string().min(16).max(4096), data: z.unknown() })).mutation(async ({ input }) => {
      if (!isPublishableSourceData(input.data)) return { status: "invalid_data" as const, updatedAt: null };
      try {
        const result = await publishToSourceAdmin(input.token, input.data);
        return { status: "ok" as const, updatedAt: result.updatedAt };
      } catch (error) {
        if (error instanceof SourceAdminError && error.status === 401) return { status: "expired" as const, updatedAt: null };
        console.warn("[source-admin] Content publish unavailable", error);
        return { status: "unavailable" as const, updatedAt: null };
      }
    }),
    upload: publicProcedure.input(z.object({ token: z.string().min(16).max(4096), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), imageBase64: z.string().min(8).max(7_000_000) })).mutation(async ({ input }) => {
      try {
        return { status: "ok" as const, url: (await uploadToSourceAdmin(input.token, input.contentType, input.imageBase64)).url };
      } catch (error) {
        if (error instanceof SourceAdminError && error.status === 401) return { status: "expired" as const, url: null };
        if (error instanceof SourceAdminError && error.status === 413) return { status: "too_large" as const, url: null };
        console.warn("[source-admin] Image upload unavailable", error);
        return { status: "unavailable" as const, url: null };
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
