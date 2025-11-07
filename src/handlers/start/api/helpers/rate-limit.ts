import { RateLimitResult } from "./types";

const rateState: Map<string, { count: number; resetAt: number }> = new Map();

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const state = rateState.get(key);

  if (!state || now > state.resetAt) {
    rateState.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
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
