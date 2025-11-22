import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ClientRateLimitInfo, ConfigType, Store } from "hono-rate-limiter";

export class KvStore implements Store {
  _options: ConfigType | undefined;
  prefix = "rate-limiter";

  constructor(
    readonly _store: {
      get: <T>(key: string[]) => Promise<{ value: T | null }>;
      set: <T>(key: string[], value: T, options?: { expireIn?: number }) => Promise<void>;
      delete: (key: string[]) => Promise<void>;
    }
  ) {}

  async decrement(key: string) {
    const nowMs = Date.now();
    const record = await this.get(key);

    const existingResetTimeMs = record?.resetTime && new Date(record.resetTime).getTime();
    const isActiveWindow = existingResetTimeMs && existingResetTimeMs > nowMs;

    if (isActiveWindow && record) {
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
    const nowMs = Date.now();
    const record = await this.get(key);
    const defaultResetTime = new Date(nowMs + (this._options?.windowMs ?? 60000));

    const existingResetTimeMs = record?.resetTime && new Date(record.resetTime).getTime();
    const isActiveWindow = existingResetTimeMs && existingResetTimeMs > nowMs;

    const payload: ClientRateLimitInfo = {
      totalHits: isActiveWindow ? record.totalHits + 1 : 1,
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

/**
 * Checks rate limit for a user and mode.
 * Returns null if allowed, or a Response with rate limit error if exceeded.
 */
export async function checkUserRateLimit(userId: number, mode: "validate" | "execute", kvStore: KvStore, logger: Logs): Promise<Response | null> {
  const limit = mode === "execute" ? 3 : 10; // 3 for POST, 10 for GET
  const windowMs = 60 * 1000; // 1 minute
  const key = `user:${userId}:${mode}`;

  // Set windowMs option for the store (partial config is okay)
  kvStore._options = { windowMs } as ConfigType;

  const info = await kvStore.increment(key);
  const resetTime = info.resetTime;
  if (!resetTime) {
    // Should not happen, but handle gracefully
    return null;
  }
  const resetAt = typeof resetTime === "number" ? resetTime : new Date(resetTime).getTime();

  if (info.totalHits > limit) {
    return Response.json(
      {
        ok: false,
        reasons: [logger.warn("RateLimit: exceeded", { key, resetAt, limit }).logMessage.raw],
        resetAt,
      },
      { status: 429 }
    );
  }

  return null; // Allowed
}
