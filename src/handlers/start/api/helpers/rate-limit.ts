import { Context } from "hono";
import { getConnInfo } from "hono/deno";
import { ClientRateLimitInfo, ConfigType, Store } from "hono-rate-limiter";
import { validateReqEnv } from "../../../../utils/validate-env";

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

    // Use atomic operation with TTL (expire after windowMs + some buffer)
    const expireIn = (this._options?.windowMs ?? 60000) + 30000; // 30 second buffer
    await this._store.atomic().set([this.prefix, key], payload, { expireIn }).commit();

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
 * Creates an IP-based rate limiter middleware for the /start endpoint.
 * Uses hono-rate-limiter with IP-based keys.
 * Different limits apply: 10 for validate (GET), 3 for execute (POST).
 *
 * Rate limiting happens before authentication to prevent abuse.
 */
export async function createUserRateLimiter(c: Context, next: () => Promise<void>) {
  const validatedEnv = validateReqEnv(c);
  if (validatedEnv instanceof Response) {
    return validatedEnv;
  }
  const kvStore = await createKvStore();

  const request = c.req.raw as Request;
  const mode = request.method === "POST" ? "execute" : "validate";
  const limit = mode === "execute" ? 3 : 10; // 3 for POST, 10 for GET

  const remoteAddr = getConnInfo(c).remote.address;
  const rateLimitKey = remoteAddr ? `ip:${remoteAddr}:${mode}` : `unknown:${mode}`;

  const { rateLimiter } = await import("hono-rate-limiter");
  const ipLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    keyGenerator: () => rateLimitKey,
    store: kvStore,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  });

  return await ipLimiter(c, next);
}
