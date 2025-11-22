import process from "node:process";
import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "hono";
import { cors } from "hono/cors";
import { getConnInfo } from "hono/deno";
import { rateLimiter } from "hono-rate-limiter";
import manifest from "../manifest.json" with { type: "json" };
import { createAdapters } from "./adapters/index";
import { KvStore } from "./handlers/start/api/helpers/rate-limit";
import { handlePublicStart } from "./handlers/start/api/public-api";
import { startStopTask } from "./plugin";
import { Command } from "./types/command";
import { SupportedEvents } from "./types/index";
import { Env, envSchema } from "./types/index";
import { PluginSettings, pluginSettingsSchema } from "./types/index";
import { validateReqEnv } from "./utils/validate-env";

const START_API_PATH = "/start";

function computeAllowedOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null;
  const configured = (env.PUBLIC_API_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured.includes("*")) return origin; // wildcard allowed (no credentials usage expected)
  if (configured.length > 0 && configured.includes(origin)) return origin;
  // Dev convenience only in dev/local NODE_ENV: allow localhost & 127.0.0.1 if not explicitly set
  if (configured.length === 0) {
    const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : env?.NODE_ENV;
    const isDev = nodeEnv === "development" || nodeEnv === "local";
    if (isDev && /^(http:\/\/)?(localhost|127\.0\.0\.1)/.test(origin)) {
      return origin;
    }
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, executionCtx?: ExecutionContext) {
    const honoApp = createPlugin<PluginSettings, Env, Command, SupportedEvents>(
      (context) => {
        return startStopTask({
          ...context,
          adapters: {} as ReturnType<typeof createAdapters>,
          organizations: [],
        });
      },
      manifest as Manifest,
      {
        envSchema: envSchema,
        postCommentOnError: true,
        settingsSchema: pluginSettingsSchema,
        logLevel: (env.LOG_LEVEL as LogLevel) ?? LOG_LEVEL.INFO,
        kernelPublicKey: env.KERNEL_PUBLIC_KEY as string,
        bypassSignatureVerification: process.env.NODE_ENV === "local",
      }
    );

    honoApp.use(
      START_API_PATH,
      cors({
        origin: (origin) => {
          const allowed = computeAllowedOrigin(origin, env);
          return allowed ? origin : null;
        },
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        maxAge: 86400,
        credentials: true,
      })
    );

    // Global rate limiter for all routes except /start (which has its own per-user rate limiting)
    // Apply rate limiter only to routes that are not /start
    honoApp.use(async (c, next) => {
      if (c.req.path === START_API_PATH) {
        // Skip global rate limiter for /start route - it has its own per-user rate limiting
        return next();
      }
      // For other routes, apply the rate limiter
      const globalLimiter = rateLimiter({
        windowMs: 60 * 1000,
        limit: 100,
        standardHeaders: "draft-7",
        keyGenerator: (ctx) => {
          return getConnInfo(ctx).remote.address ?? "";
        },
        store: new KvStore(env.RATE_LIMIT_KV),
      });
      return globalLimiter(c, next);
    });

    // CORS preflight for public API
    honoApp.options(START_API_PATH, (c) => {
      const validatedEnv = validateReqEnv(c);
      if (validatedEnv instanceof Response) {
        return validatedEnv;
      }

      return new Response(null, { status: 200 });
    });

    // Public API routes with CORS applied
    // GET route for validation only
    honoApp.get(START_API_PATH, async (c) => {
      const validatedEnv = validateReqEnv(c);
      if (validatedEnv instanceof Response) {
        return validatedEnv;
      }

      return await handlePublicStart(c, validatedEnv);
    });

    // POST route for execution
    honoApp.post(START_API_PATH, async (c) => {
      const validatedEnv = validateReqEnv(c);
      if (validatedEnv instanceof Response) {
        return validatedEnv;
      }

      return await handlePublicStart(c, validatedEnv);
    });

    return honoApp.fetch(request, env, executionCtx);
  },
};
