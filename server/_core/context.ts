import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { AdminEnv } from "../admin-store";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /**
   * Cloudflare bindings, present only when the worker serves the request. The express dev
   * server has no KV namespace and no secrets, so content administration reports itself
   * unavailable there rather than pretending to work.
   */
  env?: AdminEnv;
  /** The caller's address, used to throttle admin logins per address. */
  ip?: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
