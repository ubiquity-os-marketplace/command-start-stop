import { Value } from "@sinclair/typebox/value";
import { Context as HonoContext } from "hono";
import { Logs } from "../../../types/context";
import { Env } from "../../../types/env";
import { extractJwtFromHeader, verifyJwt } from "./helpers/auth";
import { buildShallowContextObject } from "./helpers/context-builder";
import { fetchMergedPluginSettings } from "./helpers/get-plugin-config";
import { StartQueryParams, startQueryParamSchema } from "./helpers/types";
import { handleValidateOrExecute, handleBatchValidateOrExecute } from "./validate-or-execute";

/**
 * Main handler for the public start API endpoint.
 * Supports two modes:
 * 1. Validate: validates eligibility without performing assignment (GET)
 * 2. Execute: validates and performs assignment (POST)
 * Supports single issueUrl or multiple issueUrls (batch mode).
 */
export async function handlePublicStart(honoCtx: HonoContext, env: Env, logger: Logs): Promise<Response> {
  const request = honoCtx.req.raw as Request;

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const mode = request.method === "POST" ? "execute" : "validate";

  try {
    const jwt = extractJwtFromHeader(request);
    if (!jwt) {
      return Response.json(
        {
          ok: false,
          reasons: [logger.warn("Missing Authorization header").logMessage.raw],
        },
        { status: 401 }
      );
    }

    const { user, error: authError } = await authenticateRequest({ env, logger, jwt });
    if (authError) {
      logger.warn(authError.body ? JSON.stringify(await authError.clone().json()) : "Authentication error without body");
      return authError;
    }
    if (!user) {
      return Response.json(
        {
          ok: false,
          reasons: [logger.warn("Unauthorized: User authentication failed").logMessage.raw],
        },
        { status: 401 }
      );
    }

    const params = await validateQueryParams(honoCtx, logger);
    if (params instanceof Response) return params;

    const context = await buildShallowContextObject({
      env,
      accessToken: user.accessToken,
      userId: params.userId,
      logger,
    });

    // Normalize issueUrls: params.issueUrl is decoded as string[] by the Transform
    const issueUrls: string[] = params.issueUrl as unknown as string[];

    // Batch mode: more than 1 URL
    if (issueUrls.length > 1) {
      const firstUrl = issueUrls[0];
      context.config = await fetchMergedPluginSettings({
        env,
        issueUrl: firstUrl,
        logger,
        environment: params.environment,
        jwt,
      });

      const results = await handleBatchValidateOrExecute({ context, mode, issueUrls, jwt });

      const successful = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok).length;

      return Response.json(
        {
          ok: failed === 0,
          results,
          summary: {
            total: issueUrls.length,
            successful,
            failed,
          },
        },
        { status: 200 }
      );
    }

    // Single URL mode (backward compatible)
    const issueUrl = issueUrls[0];
    context.config = await fetchMergedPluginSettings({
      env,
      issueUrl,
      logger,
      environment: params.environment,
      jwt,
    });

    return await handleValidateOrExecute({ context, mode, issueUrl, jwt });
  } catch (error) {
    return handleError(error, logger);
  }
}

async function validateQueryParams(honoCtx: HonoContext, logger: Logs): Promise<StartQueryParams | Response> {
  let params: StartQueryParams;
  if (honoCtx.req.raw.method === "POST") {
    try {
      params = await honoCtx.req.json();
    } catch (error) {
      logger.warn("Invalid JSON body", { e: error });
      return Response.json(
        { ok: false, reasons: [error instanceof Error ? error.message : String(error)] },
        { status: 400 }
      );
    }
  } else {
    // GET: parse query params, handle repeated issueUrl params
    const raw: Record<string, unknown> = {};
    const url = new URL(honoCtx.req.raw.url);
    for (const [key, value] of url.searchParams.entries()) {
      if (key === "issueUrl") {
        const allValues = url.searchParams.getAll("issueUrl");
        raw[key] = allValues.length > 1 ? allValues : value;
      } else {
        raw[key] = value;
      }
    }
    params = raw as unknown as StartQueryParams;
  }

  try {
    if (!Value.Check(startQueryParamSchema, params)) {
      const errors = [...Value.Errors(startQueryParamSchema, params)];
      const reasons = errors.map((e) => `JSON validation: ${e.path}: ${e.message}`);
      logger.warn("Request body validation failed", { reasons });
      return Response.json({ ok: false, reasons }, { status: 400 });
    }

    params = Value.Decode(startQueryParamSchema, Value.Default(startQueryParamSchema, params));
  } catch (error) {
    logger.warn("Invalid JSON body", { e: error });
    return Response.json(
      { ok: false, reasons: [error instanceof Error ? error.message : String(error)] },
      { status: 400 }
    );
  }
  return params;
}

async function authenticateRequest({ env, logger, jwt }: { env: Env; logger: Logs; jwt: string }) {
  try {
    const user = await verifyJwt({ env, jwt, logger });
    if (!user) {
      throw logger.warn("Unauthorized: User not found");
    }
    return { user };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized: Invalid JWT, expired, or user not found";
    return {
      user: null,
      error: Response.json({ ok: false, reasons: [message] }, { status: 401 }),
    };
  }
}

function handleError(error: unknown, logger: Logs): Response {
  const message = error instanceof Error ? error.message : "Internal error";
  const isUnauthorized = error instanceof Error && error.message.toLowerCase().includes("unauthorized");
  const status = isUnauthorized ? 401 : 500;
  logger.error("PublicStart: unhandled error", { message, status, e: error });
  return Response.json({ ok: false, reasons: [message] }, { status });
}