import { Value } from "@sinclair/typebox/value";
import { Context as HonoContext } from "hono";
import { Logs } from "../../../types/context";
import { Env } from "../../../types/env";
import { extractJwtFromHeader, verifyJwt } from "./helpers/auth";
import { buildShallowContextObject } from "./helpers/context-builder";
import { fetchMergedPluginSettings } from "./helpers/get-plugin-config";
import { StartQueryParams, startQueryParamSchema, SingleIssueResult, BatchStartResponse } from "./helpers/types";
import { handleValidateOrExecute } from "./validate-or-execute";

const MAX_CONCURRENCY = 10;

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
        { ok: false, reasons: [logger.warn("Missing Authorization header").logMessage.raw] },
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
        { ok: false, reasons: [logger.warn("Unauthorized: User authentication failed").logMessage.raw] },
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

    // Normalize issueUrl to array
    const issueUrls: string[] = Array.isArray(params.issueUrl) ? params.issueUrl : [params.issueUrl];

    // Single URL: backward-compatible path
    if (issueUrls.length === 1) {
      context.config = await fetchMergedPluginSettings({
        env,
        issueUrl: issueUrls[0],
        logger,
        environment: params.environment,
        jwt,
      });
      return await handleValidateOrExecute({ context, mode, issueUrl: issueUrls[0], jwt });
    }

    // Multiple URLs: batch processing
    const results: SingleIssueResult[] = [];
    let successful = 0;
    let failed = 0;

    // Process in batches of MAX_CONCURRENCY using Promise.allSettled
    for (let i = 0; i < issueUrls.length; i += MAX_CONCURRENCY) {
      const batch = issueUrls.slice(i, i + MAX_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map(async (issueUrl) => {
          const urlContext = await buildShallowContextObject({
            env,
            accessToken: user.accessToken,
            userId: params.userId,
            logger,
          });
          urlContext.config = await fetchMergedPluginSettings({
            env,
            issueUrl,
            logger,
            environment: params.environment,
            jwt,
          });
          const resp = await handleValidateOrExecute({ context: urlContext, mode, issueUrl, jwt });
          const data = await resp.json();
          return { issueUrl, ok: data.ok, computed: data.computed ?? null, warnings: data.warnings ?? null, reasons: data.reasons ?? null };
        })
      );

      for (const r of settled) {
        if (r.status === "fulfilled") {
          const result = r.value as SingleIssueResult;
          results.push(result);
          if (result.ok) successful++;
          else failed++;
        } else {
          results.push({ issueUrl: "unknown", ok: false, computed: null, warnings: null, reasons: [r.reason?.message ?? "Unknown error"] });
          failed++;
        }
      }
    }

    const response: BatchStartResponse = {
      ok: failed === 0,
      results,
      summary: { total: issueUrls.length, successful, failed },
    };
    return Response.json(response, { status: 200 });
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
      logger.warn("Invalid JSON body", { e: error });
      return Response.json(
        { ok: false, reasons: [error instanceof Error ? error.message : String(error)] },
        {
          status: 400,
        }
      );
    }
  } else {
    // For GET requests, extract params manually to support multi-value issueUrl
    const url = new URL(honoCtx.req.raw.url);
    const searchParams = url.searchParams;
    const entries: Array<[string, string]> = [];
    searchParams.forEach((value, key) => {
      entries.push([key, value]);
    });
    const rawParams = Object.fromEntries(entries) as Record<string, string | string[]>;
    // If issueUrl appears multiple times, convert to array
    if (searchParams.getAll("issueUrl").length > 1) {
      rawParams.issueUrl = searchParams.getAll("issueUrl");
    }
    params = rawParams as unknown as StartQueryParams;
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
    const user = await verifyJwt({
      env,
      jwt,
      logger,
    });

    if (!user) {
      throw logger.warn("Unauthorized: User not found");
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
 * Handles errors and returns an appropriate response.
 */
function handleError(error: unknown, logger: Logs): Response {
  const message = error instanceof Error ? error.message : "Internal error";
  const isUnauthorized = error instanceof Error && error.message.toLowerCase().includes("unauthorized");
  const status = isUnauthorized ? 401 : 500;
  logger.error("PublicStart: unhandled error", { message, status, e: error });
  return Response.json({ ok: false, reasons: [message] }, { status });
}
