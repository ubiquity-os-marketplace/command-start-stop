import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "hono";
import manifest from "../manifest.json";
import { createAdapters } from "./adapters/index";
import { startStopTask } from "./plugin";
import { Command } from "./types/command";
import { SupportedEvents } from "./types/context";
import { Env, envSchema } from "./types/env";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input";
import { handlePublicStart } from "./handlers/start/api/public-api";

const START_API_PATH = "/public/start";

function computeAllowedOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null;
  const configured = (env.PUBLIC_API_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured.includes("*")) return origin; // wildcard allowed (no credentials usage expected)
  if (configured.length > 0 && configured.includes(origin)) return origin;
  // Dev convenience: allow localhost & 127.0.0.1 if not explicitly set
  if (configured.length === 0 && /^(http:\/\/)?(localhost|127\.0\.0\.1)/.test(origin)) return origin;
  return null;
}

function applyCors(request: Request, response: Response, env: Env): Response {
  const origin = request.headers.get("origin") || request.headers.get("Origin");
  const allowed = computeAllowedOrigin(origin, env);
  if (!allowed) return response; // Not adding headers if origin not allowed
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowed);
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env, executionCtx?: ExecutionContext) {
    // Merge runtime-provided env with process.env for local dev (e.g., `bun dev`)
    const mergedEnv: Env = {
      APP_ID: (env.APP_ID ?? process.env.APP_ID) as string,
      APP_PRIVATE_KEY: (env.APP_PRIVATE_KEY ?? process.env.APP_PRIVATE_KEY) as string,
      SUPABASE_URL: (env.SUPABASE_URL ?? process.env.SUPABASE_URL) as string,
      SUPABASE_KEY: (env.SUPABASE_KEY ?? process.env.SUPABASE_KEY) as string,
      BOT_USER_ID: (env.BOT_USER_ID ?? (process.env.BOT_USER_ID as unknown)) as number,
      KERNEL_PUBLIC_KEY: (env.KERNEL_PUBLIC_KEY ?? process.env.KERNEL_PUBLIC_KEY) as string | undefined,
      LOG_LEVEL: (env.LOG_LEVEL ?? process.env.LOG_LEVEL) as string | undefined,
      XP_SERVICE_BASE_URL: (env.XP_SERVICE_BASE_URL ?? process.env.XP_SERVICE_BASE_URL) as string | undefined,
      PUBLIC_API_ALLOWED_ORIGINS: env.PUBLIC_API_ALLOWED_ORIGINS ?? process.env.PUBLIC_API_ALLOWED_ORIGINS,
    } as Env;

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
        logLevel: (mergedEnv.LOG_LEVEL as LogLevel) ?? LOG_LEVEL.INFO,
        kernelPublicKey: mergedEnv.KERNEL_PUBLIC_KEY as string,
        bypassSignatureVerification: process.env.NODE_ENV === "local",
      }
    );

    // CORS preflight for public API
    honoApp.options(START_API_PATH, (c) => {
      const origin = c.req.header("origin") || c.req.header("Origin") || null;
      const allowed = computeAllowedOrigin(origin, mergedEnv);
      if (!allowed) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowed,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        },
      });
    });

    // Public API route with CORS applied
    honoApp.post(START_API_PATH, async (c) => {
      const res = await handlePublicStart(c.req.raw as Request, mergedEnv);
      return applyCors(c.req.raw as Request, res, mergedEnv);
    });

    // Global fetch: attach CORS if response is for public route & origin allowed
    const response = await honoApp.fetch(request, mergedEnv, executionCtx);
    if (new URL(request.url).pathname === START_API_PATH) {
      return applyCors(request, response, mergedEnv);
    }
    return response;
  },
};
