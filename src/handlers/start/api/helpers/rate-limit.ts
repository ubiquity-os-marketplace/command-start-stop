import { Context } from "hono";
import { getConnInfo } from "hono/deno";
import { ClientRateLimitInfo, ConfigType, Store } from "hono-rate-limiter";
import { validateReqEnv } from "../../../../utils/validate-env";
import { extractJwtFromHeader, verifySupabaseJwt } from "./auth";
import { createLogger } from "./context-builder";

export class KvStore implements Store {
  _options: ConfigType | undefined;
  prefix = "rate-limiter";

  constructor(readonly _store: Deno.Kv) {}

  init(options: ConfigType): void {
    this._options = options;
  }

  private async _getWindowInfo(key: string): Promise<{
    nowMs: number;
    record: ClientRateLimitInfo | undefined;
    existingResetTimeMs: number | undefined;
    isActiveWindow: boolean;
  }> {
    const nowMs = Date.now();
    const record = await this.get(key);

    let existingResetTimeMs: number | undefined;
    if (record?.resetTime) {
      if (record.resetTime instanceof Date) {
        existingResetTimeMs = record.resetTime.getTime();
      } else if (typeof record.resetTime === "string" || typeof record.resetTime === "number") {
        existingResetTimeMs = new Date(record.resetTime).getTime();
      }
    }

    const isActiveWindow = existingResetTimeMs !== undefined && existingResetTimeMs > nowMs;

    return { nowMs, record, existingResetTimeMs, isActiveWindow };
  }

  async decrement(key: string) {
    const { record, existingResetTimeMs, isActiveWindow } = await this._getWindowInfo(key);

    if (isActiveWindow && record && existingResetTimeMs !== undefined) {
      const payload: ClientRateLimitInfo = {
        totalHits: Math.max(0, record.totalHits - 1),
        resetTime: new Date(existingResetTimeMs),
      };

      await this.updateRecord(key, payload);
    }
  }

  async resetKey(key: string) {
    await this._store.delete([this.prefix, key]);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const { nowMs, record, existingResetTimeMs, isActiveWindow } = await this._getWindowInfo(key);
    const defaultResetTime = new Date(nowMs + (this._options?.windowMs ?? 60000));

    const payload: ClientRateLimitInfo = {
      totalHits: isActiveWindow && record ? record.totalHits + 1 : 1,
      resetTime: isActiveWindow && existingResetTimeMs ? new Date(existingResetTimeMs) : defaultResetTime,
    };

    await this.updateRecord(key, payload);

    return payload;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const res = await this._store.get<ClientRateLimitInfo>([this.prefix, key]);
    return res?.value ?? undefined;
  }

  async updateRecord(key: string, payload: ClientRateLimitInfo): Promise<void> {
    await this._store.set([this.prefix, key], payload);
  }
}

export async function createKvStore(): Promise<KvStore> {
  if (typeof Deno !== "undefined" && Deno.openKv) {
    const kv = await Deno.openKv();
    if (!kv) {
      throw new Error("Failed to open Deno KV");
    }
    return new KvStore(kv);
  }

  throw new Error("KV store is not available");
}

/**
 * Creates a user-specific rate limiter middleware for the /start endpoint.
 * Uses hono-rate-limiter with custom keyGenerator that includes user ID and mode.
 * Different limits apply: 10 for validate (GET), 3 for execute (POST).
 *
 * Note: This middleware authenticates the user first. If authentication fails,
 * it allows the request to proceed (the handler will return 401).
 */
export async function createUserRateLimiter(c: Context, next: () => Promise<void>) {
  const validatedEnv = validateReqEnv(c);
  if (validatedEnv instanceof Response) {
    return validatedEnv;
  }
  const logger = createLogger(validatedEnv);
  const kvStore = await createKvStore();

  const request = c.req.raw as Request;
  const mode = request.method === "POST" ? "execute" : "validate";
  const limit = mode === "execute" ? 3 : 10; // 3 for POST, 10 for GET
  let rateLimitKey: string | null = null;

  // Authenticate user first
  const jwt = extractJwtFromHeader(request);

  if (jwt) {
    let user: { id: number } | null = null;
    try {
      const verifiedUser = await verifySupabaseJwt({ env: validatedEnv, jwt, logger });
      user = verifiedUser ? { id: verifiedUser.id } : null;
      if (user) {
        rateLimitKey = `user:${user.id}:${mode}`;
      }
    } catch (err) {
      // If auth fails, let the handler deal with it
      console.warn("Failed to authenticate user", err);
    }
  }

  if (rateLimitKey === null) {
    rateLimitKey = getConnInfo(c).remote.address ?? "";
  }

  const { rateLimiter } = await import("hono-rate-limiter");
  const userLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    keyGenerator: () => rateLimitKey,
    store: kvStore,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  });

  return await userLimiter(c, next);
}
