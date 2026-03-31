import process from "node:process";
import { swaggerUI } from "@hono/swagger-ui";
import { createPlugin, Options } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "hono";
import { cors } from "hono/cors";
import { describeRoute, openAPIRouteHandler, resolver, validator } from "hono-openapi";
import "@hono/standard-validator"; // Ensure Deno deploy includes optional peer for hono-openapi.
import "@valibot/to-json-schema"; // Same here
import manifest from "../manifest.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };
import { createAdapters } from "./adapters/index";
import { createLogger } from "./handlers/start/api/helpers/context-builder";
import { createUserRateLimiter } from "./handlers/start/api/helpers/rate-limit";
import { handlePublicStart } from "./handlers/start/api/public-api";
import { startStopTask } from "./plugin";
import { Command } from "./types/command";
import { SupportedEvents } from "./types/context";
import { Env, envSchema } from "./types/env";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input";
import { validateReqEnv } from "./utils/validate-env";
import { querySchema, responseSchema } from "./validators/start";

const START_API_PATH = "/start";
const pluginManifest = manifest as Manifest & { homepage_url?: string };

function readRuntimeEnv(name: string): string {
  const processValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (typeof processValue === "string" && processValue.length > 0) {
    return processValue;
  }

  if (typeof Deno !== "undefined") {
    try {
      return Deno.env.get(name) ?? "";
    } catch {
      return "";
    }
  }

  return "";
}

function resolveManifestRepository(): string {
  const shortName = typeof pluginManifest.short_name === "string" ? pluginManifest.short_name.trim() : "";
  const atIndex = shortName.lastIndexOf("@");
  if (atIndex > 0) {
    return shortName.slice(0, atIndex);
  }

  return readRuntimeEnv("PLUGIN_MANIFEST_REPOSITORY") || "local/command-start-stop";
}

function sanitizeBranchRefName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function resolveBranchHostnameSlug(request: Request): string {
  const hostname = new URL(request.url).hostname;
  const branchMatch = hostname.match(/--([^.]+)/);
  return branchMatch?.[1] || "";
}

function resolveRuntimeRefOverride(request: Request): string {
  const explicitRef = readRuntimeEnv("PLUGIN_MANIFEST_REF_NAME") || readRuntimeEnv("REF_NAME");
  if (!explicitRef) {
    return "";
  }

  const hostnameBranchSlug = resolveBranchHostnameSlug(request);
  if (!hostnameBranchSlug) {
    return explicitRef;
  }

  const explicitBranchSlug = sanitizeBranchRefName(explicitRef);
  if (explicitBranchSlug === hostnameBranchSlug || explicitBranchSlug.startsWith(hostnameBranchSlug)) {
    return explicitRef;
  }

  return "";
}

function resolveRuntimeRefName(request: Request): string {
  const runtimeRefOverride = resolveRuntimeRefOverride(request);
  const timeline = readRuntimeEnv("DENO_TIMELINE");
  if (timeline === "production") {
    return "main";
  }

  if (timeline.startsWith("git-branch/")) {
    return runtimeRefOverride || timeline.slice("git-branch/".length);
  }

  if (timeline.startsWith("preview/")) {
    return timeline.slice("preview/".length);
  }

  const hostnameBranchSlug = resolveBranchHostnameSlug(request);
  if (hostnameBranchSlug) {
    return runtimeRefOverride || hostnameBranchSlug;
  }

  const deploymentId = readRuntimeEnv("DENO_DEPLOYMENT_ID");
  if (deploymentId) {
    return deploymentId;
  }

  return "local";
}

function buildRuntimeManifest(request: Request) {
  return {
    ...pluginManifest,
    short_name: `${resolveManifestRepository()}@${resolveRuntimeRefName(request)}`,
    homepage_url: new URL(request.url).origin,
  };
}

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
    if (new URL(request.url).pathname === "/manifest.json") {
      return Response.json(buildRuntimeManifest(request));
    }

    const honoApp = createPlugin<PluginSettings, Env, Command, SupportedEvents>(
      (context) => {
        return startStopTask({
          ...context,
          adapters: {} as ReturnType<typeof createAdapters>,
          organizations: [],
        });
      },
      pluginManifest,
      {
        settingsSchema: pluginSettingsSchema as unknown as Options["settingsSchema"],
        envSchema: envSchema as unknown as Options["envSchema"],
        postCommentOnError: true,
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
    // User-specific rate limiter: 10 for validate (GET), 3 for execute (POST) per user per minute
    honoApp.use(START_API_PATH, createUserRateLimiter);

    // CORS preflight for public API
    honoApp.options(START_API_PATH, (c) => {
      const validatedEnv = validateReqEnv(c);
      return validatedEnv instanceof Response ? validatedEnv : new Response(null, { status: 200 });
    });

    // Public API routes with CORS applied
    // GET route for validation only
    honoApp.get(
      START_API_PATH,
      describeRoute({
        description: "Check if a user can start a specific task.",
        security: [{ Bearer: [] }],
        responses: {
          200: {
            description: "Successful response",
            content: {
              "application/json": { schema: resolver(responseSchema) },
            },
          },
        },
      }),
      validator("query", querySchema),
      async (c) => {
        const validatedEnv = validateReqEnv(c);
        if (validatedEnv instanceof Response) {
          return validatedEnv;
        }

        return await handlePublicStart(c, validatedEnv, createLogger(env));
      }
    );

    // POST route for execution
    honoApp.post(
      START_API_PATH,
      describeRoute({
        description: "Starts the task for a given user.",
        security: [{ Bearer: [] }],
        responses: {
          200: {
            description: "Successful response",
            content: {
              "application/json": { schema: resolver(responseSchema) },
            },
          },
        },
      }),
      validator("json", querySchema),
      async (c) => {
        const validatedEnv = validateReqEnv(c);
        if (validatedEnv instanceof Response) {
          return validatedEnv;
        }

        return await handlePublicStart(c, validatedEnv, createLogger(env));
      }
    );

    const openApiServers = [{ url: "http://localhost:4000", description: "Local Server" }];
    if (typeof pluginManifest.homepage_url === "string" && pluginManifest.homepage_url.trim().length > 0) {
      openApiServers.push({ url: pluginManifest.homepage_url, description: "Production Server" });
    }

    honoApp.get(
      "/openapi",
      openAPIRouteHandler(honoApp, {
        documentation: {
          info: {
            title: pkg.name,
            version: pkg.version,
            description: pkg.description,
          },
          servers: openApiServers,
          security: [{ Bearer: [] }],
          components: {
            securitySchemes: {
              Bearer: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
              },
            },
          },
        },
      })
    );
    honoApp.get("/docs", swaggerUI({ url: "/openapi" }));

    return honoApp.fetch(request, env, executionCtx);
  },
};
