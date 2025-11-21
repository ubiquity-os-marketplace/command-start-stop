import { Value } from "@sinclair/typebox/value";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Context as HonoContext } from "hono";
import { Env } from "../../../types/env";
import { extractJwtFromHeader, verifySupabaseJwt } from "./helpers/auth";
import { buildShallowContextObject, createLogger } from "./helpers/context-builder";
import { fetchMergedPluginSettings } from "./helpers/get-plugin-config";
import { getClientId, rateLimit } from "./helpers/rate-limit";
import { StartQueryParams, startQueryParamSchema } from "./helpers/types";
import { handleValidateOrExecute } from "./validate-or-execute";

// Type declaration for Cloudflare KV
declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  }
}

/**
 * Main handler for the public start API endpoint.
 * Supports two modes:
 * 1. Validate: validates eligibility without performing assignment
 * 2. Execute: validates and performs assignment
 *
 * @param request - HTTP request object
 * @param env - Environment variables
 * @returns HTTP response with appropriate status and body
 */
export async function handlePublicStart(honoCtx: HonoContext, env: Env): Promise<Response> {
  const request = honoCtx.req.raw as Request;

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const mode = request.method === "POST" ? "execute" : "validate";
  const logger = createLogger(env);

  try {
    // Check for JWT token first before parsing body
    const jwt = extractJwtFromHeader(request);
    if (!jwt) {
      return Response.json(
        {
          ok: false,
          reasons: [logger.error("Missing Authorization header").logMessage.raw],
        },
        { status: 401 }
      );
    }

    const { user, error: authError } = await authenticateRequest({
      env,
      logger,
      jwt,
    });
    if (authError) {
      logger.error(authError.body ? JSON.stringify(await authError.clone().json()) : "Authentication error without body");
      return authError;
    }
    if (!user) {
      return Response.json(
        {
          ok: false,
          reasons: [logger.error("Unauthorized: User authentication failed").logMessage.raw],
        },
        { status: 401 }
      );
    }

    // Validate environment and parse request query params
    const params = await validateQueryParams(honoCtx, logger);
    if (params instanceof Response) return params;
    const { userId, issueUrl } = params;

    // Apply rate limiting
    const rateLimitError = await applyRateLimit({ request, userId, mode, env, logger });
    if (rateLimitError) return rateLimitError;

    // Build context and load merged plugin settings from org/repo config
    const context = await buildShallowContextObject({
      env,
      accessToken: user.accessToken,
      logger,
    });

    context.config = await fetchMergedPluginSettings({
      env,
      issueUrl,
      logger,
    });

    return await handleValidateOrExecute({ context, mode, issueUrl });
  } catch (error) {
    return handleError(error, logger);
  }
}

async function validateQueryParams(honoCtx: HonoContext, logger: Logs) {
  let params: StartQueryParams;
  if (honoCtx.req.raw.method === "POST") {
    try {
      params = await honoCtx.req.json();
    } catch (error) {
      logger.error("Invalid JSON body", { e: error });
      return Response.json(
        { ok: false, reasons: [error instanceof Error ? error.message : String(error)] },
        {
          status: 400,
        }
      );
    }
  } else {
    params = Object.fromEntries(new URL(honoCtx.req.raw.url).searchParams.entries()) as unknown as StartQueryParams;
  }

  try {
    if (!Value.Check(startQueryParamSchema, params)) {
      const errors = [...Value.Errors(startQueryParamSchema, params)];
      const reasons = errors.map((e) => `JSON validation: ${e.path}: ${e.message}`);
      logger.error("Request body validation failed", { reasons });
      return Response.json({ ok: false, reasons }, { status: 400 });
    }

    params = Value.Decode(startQueryParamSchema, Value.Default(startQueryParamSchema, params));
  } catch (error) {
    logger.error("Invalid JSON body", { e: error });
    return Response.json(
      { ok: false, reasons: [error instanceof Error ? error.message : String(error)] },
      {
        status: 400,
      }
    );
  }
  return params;
}

/**
 * Authenticates the request and returns the user if successful.
 */
async function authenticateRequest({ env, logger, jwt }: { env: Env; logger: Logs; jwt: string }) {
  try {
    const user = await verifySupabaseJwt({
      env,
      jwt,
      logger,
    });

    if (!user) {
      throw new Error("Unauthorized: User not found");
    }

    return { user };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized: Invalid JWT, expired, or user not found";
    return {
      user: null,
      accessToken: null,
      error: Response.json(
        {
          ok: false,
          reasons: [message],
        },
        { status: 401 }
      ),
    };
  }
}

/**
 * Applies rate limiting based on client ID, user ID, and mode.
 */
async function applyRateLimit({
  request,
  userId,
  mode,
  env,
  logger,
}: {
  request: Request;
  userId: number;
  mode: string;
  env: Env & {
    KV_RATE_LIMIT?: KVNamespace;
  };
  logger: Logs;
}): Promise<Response | null> {
  const clientId = getClientId(request);
  const key = `${clientId}|${userId}|${mode}`;
  const limit = mode === "execute" ? 3 : 10;
  const rl = await rateLimit(key, limit, 60_000, env);

  if (!rl.allowed) {
    return Response.json(
      {
        ok: false,
        reasons: [logger.warn("RateLimit: exceeded", { key, resetAt: rl.resetAt, limit }).logMessage.raw],
        resetAt: rl.resetAt,
      },
      { status: 429 }
    );
  }

  return null;
}

/**
 * Handles errors and returns an appropriate response.
 */
function handleError(error: unknown, logger: Logs): Response {
  console.trace();
  const message = error instanceof Error ? error.message : "Internal error";
  const isUnauthorized = error instanceof Error && error.message.toLowerCase().includes("unauthorized");
  const status = isUnauthorized ? 401 : 500;
  logger.error("PublicStart: unhandled error", { message, status, e: error });
  return Response.json({ ok: false, reasons: [message] }, { status });
}
