import { Env } from "../../../types/env";
import { verifySupabaseJwt, extractJwtFromHeader } from "./helpers/auth";
import { rateLimit, getClientId } from "./helpers/rate-limit";
import { buildShallowContextObject } from "./helpers/context-builder";
import { StartBody } from "./helpers/types";
import { handleValidateOrExecute } from "./validate-or-execute";

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
export async function handlePublicStart(request: Request, env: Env): Promise<Response> {
  try {
    // Validate request method
    const methodError = validateRequestMethod(request);
    if (methodError) return methodError;

    // Parse request body
    const { body, error: parseError } = await parseRequestBody(request);
    if (parseError) return parseError;
    if (!body) return Response.json({ ok: false, reasons: ["Invalid request body"] }, { status: 400 });

    // Validate body fields
    const validationError = validateBodyFields(body);
    if (validationError) return validationError;

    const { userId, issueUrl, mode = "validate" } = body;

    // Authenticate request
    const { user, accessToken, error: authError } = await authenticateRequest(body, request, env);
    if (authError) return authError;

    // Verify user authorization
    if (!user) {
      return Response.json({ ok: false, reasons: ["Unauthorized"] }, { status: 401 });
    }
    if (!accessToken) {
      return Response.json({ ok: false, reasons: ["Missing user access token"] }, { status: 401 });
    }

    // Apply rate limiting
    const rateLimitError = applyRateLimit(request, userId, mode);
    if (rateLimitError) return rateLimitError;

    // Build context
    const context = await buildShallowContextObject({ env, accessToken });

    return await handleValidateOrExecute({ context, mode, issueUrl });
  } catch (error) {
    console.log("Error in handlePublicStart:", error);
    return handleError(error);
  }
}

/**
 * Validates that the request method is POST.
 */
function validateRequestMethod(request: Request): Response | null {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }
  return null;
}

/**
 * Authenticates the request and returns the user if successful.
 */
async function authenticateRequest(body: StartBody, request: Request, env: Env) {
  const jwt = extractJwtFromHeader(request);
  if (!jwt) {
    return {
      user: null,
      accessToken: null,
      error: Response.json({ ok: false, reasons: ["Missing Authorization header"] }, { status: 401 }),
    };
  }

  const { user, accessToken } = await verifySupabaseJwt(body, env, jwt);
  return { user, accessToken, error: null };
}

/**
 * Parses and validates the request body.
 */
async function parseRequestBody(request: Request): Promise<{ body: StartBody | null; error: Response | null }> {
  try {
    const body = (await request.json()) as StartBody;
    return { body, error: null };
  } catch {
    return {
      body: null,
      error: Response.json({ ok: false, reasons: ["Invalid JSON body"] }, { status: 400 }),
    };
  }
}

/**
 * Validates the required fields in the request body.
 */
function validateBodyFields(body: StartBody): Response | null {
  const { userId, issueUrl, mode = "validate" } = body;

  if (!userId) {
    return Response.json({ ok: false, reasons: ["userId is required"] }, { status: 400 });
  }

  if (!issueUrl && mode !== "validate" && mode !== "execute") {
    return Response.json({ ok: false, reasons: ["mode must be 'validate' or 'execute' when issueUrl is provided"] }, { status: 400 });
  }

  return null;
}

/**
 * Applies rate limiting based on client ID, user ID, and mode.
 */
function applyRateLimit(request: Request, userId: number, mode: string): Response | null {
  const clientId = getClientId(request);
  const key = `${clientId}|${userId}|${mode}`;
  const limit = mode === "execute" ? 3 : 10;
  const rl = rateLimit(key, limit, 60_000);

  if (!rl.allowed) {
    return Response.json({ ok: false, reasons: ["Rate limit exceeded"], resetAt: rl.resetAt }, { status: 429 });
  }

  return null;
}

/**
 * Handles errors and returns an appropriate response.
 */
function handleError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Internal error";
  const isUnauthorized = error instanceof Error && error.message.toLowerCase().includes("unauthorized");
  const status = isUnauthorized ? 401 : 500;
  return Response.json({ ok: false, reasons: [message] }, { status });
}
