import { getRuntimeKey } from "hono/adapter";
import { Env } from "../../../../types";
import { RateLimitResult } from "./types";

const rateState: Map<string, { count: number; resetAt: number }> = new Map();

type RateLimitState = { count: number; resetAt: number };

// Type declarations for Deno and Cloudflare KV
declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  let Deno:
    | {
        openKv: () => Promise<{
          get: <T>(key: string[]) => Promise<{ value: T | null }>;
          set: <T>(key: string[], value: T, options?: { expireIn?: number }) => Promise<void>;
          close: () => void;
        }>;
      }
    | undefined;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  }
}

/**
 * Rate limiter that works with Deno KV, Cloudflare KV, or in-memory storage.
 * Automatically detects the available backend and uses it.
 *
 * @param key - Unique identifier for the rate limit (e.g., "clientId|userId|mode")
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @param env - Optional environment object containing RATE_LIMIT_KV binding
 */
export async function rateLimit(key: string, limit: number, windowMs: number, env?: Env): Promise<RateLimitResult> {
  const now = Date.now();
  const backend = getRuntimeKey();

  if (env?.NODE_ENV === "local" || env?.NODE_ENV === "development" || env?.NODE_ENV === "test") {
    // In local/dev/test, always use in-memory rate limiting
    return rateLimitMemory(key, limit, windowMs, now);
  }

  if (backend === "deno") {
    return await rateLimitDeno(key, limit, windowMs, now);
  } else if (backend === "workerd") {
    return await rateLimitCloudflare(key, limit, windowMs, now, env);
  } else {
    return rateLimitMemory(key, limit, windowMs, now);
  }
}

/**
 * Deno KV implementation
 */
async function rateLimitDeno(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult> {
  if (!Deno?.openKv) {
    throw new Error("Deno KV not available");
  }
  const kv = await Deno.openKv();
  const kvKey = ["rate_limit", key];

  try {
    const entry = await kv.get<RateLimitState>(kvKey);
    const state = entry.value;

    if (!state || now > state.resetAt) {
      const newState: RateLimitState = { count: 1, resetAt: now + windowMs };
      await kv.set(kvKey, newState, { expireIn: windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: newState.resetAt };
    }

    if (state.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: state.resetAt };
    }

    const updatedState: RateLimitState = { count: state.count + 1, resetAt: state.resetAt };
    await kv.set(kvKey, updatedState, { expireIn: state.resetAt - now });
    return { allowed: true, remaining: limit - updatedState.count, resetAt: state.resetAt };
  } finally {
    kv.close();
  }
}

/**
 * Cloudflare KV implementation
 */
async function rateLimitCloudflare(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  env?: { RATE_LIMIT_KV?: KVNamespace; NODE_ENV?: string }
): Promise<RateLimitResult> {
  const kvKey = `rate_limit:${key}`;
  const kv = env?.RATE_LIMIT_KV || (globalThis as { RATE_LIMIT_KV?: KVNamespace }).RATE_LIMIT_KV;

  if (kv) {
    try {
      const stateStr = await kv.get(kvKey);
      const state = stateStr ? (JSON.parse(stateStr) as RateLimitState) : null;

      if (!state || now > state.resetAt) {
        const newState: RateLimitState = { count: 1, resetAt: now + windowMs };
        await kv.put(kvKey, JSON.stringify(newState), { expirationTtl: Math.ceil(windowMs / 1000) });
        return { allowed: true, remaining: limit - 1, resetAt: newState.resetAt };
      }

      if (state.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: state.resetAt };
      }

      const updatedState: RateLimitState = { count: state.count + 1, resetAt: state.resetAt };
      const ttlSeconds = Math.ceil((state.resetAt - now) / 1000);
      await kv.put(kvKey, JSON.stringify(updatedState), { expirationTtl: Math.max(ttlSeconds, 1) });
      return { allowed: true, remaining: limit - updatedState.count, resetAt: state.resetAt };
    } catch (error) {
      console.error("Cloudflare KV error, falling back to memory:", error);
      return rateLimitMemory(key, limit, windowMs, now);
    }
  } else if (env?.NODE_ENV === "production" || !(env?.NODE_ENV === "development" || env?.NODE_ENV === "local" || env?.NODE_ENV === "test")) {
    throw new Error("RATE_LIMIT_KV binding not found in production environment");
  }

  return rateLimitMemory(key, limit, windowMs, now);
}

/**
 * In-memory implementation (fallback for local development)
 */
function rateLimitMemory(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const state = rateState.get(key);

  if (!state || now > state.resetAt) {
    const newState = { count: 1, resetAt: now + windowMs };
    rateState.set(key, newState);
    return { allowed: true, remaining: limit - 1, resetAt: newState.resetAt };
  }

  if (state.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: state.resetAt };
  }

  state.count += 1;
  return { allowed: true, remaining: limit - state.count, resetAt: state.resetAt };
}

export function getClientId(request: Request): string {
  const headers = request.headers;
  return (
    (headers.get("cf-connecting-ip") || headers.get("x-forwarded-for") || headers.get("x-real-ip") || "unknown") + "|" + (headers.get("user-agent") || "ua")
  );
}
