import { Env } from "../../../types/env";
import { verifySupabaseJwt, extractJwtFromHeader } from "./helpers/auth";
import { rateLimit, getClientId } from "./helpers/rate-limit";
import { buildShallowContextObject } from "./helpers/context-builder";
import { StartBody } from "./helpers/types";
import { isDevelopment } from "../../../utils/is-dev-env";
import { User } from "@supabase/supabase-js";
import { handleRecommendations } from "./directory-task-recommendations";
import { handleValidateOrExecute } from "./validate-or-execute";

/**
 * Main handler for the public start API endpoint.
 * Supports three modes:
 * 1. Recommendations: when issueUrl is omitted
 * 2. Validate: validates eligibility without performing assignment
 * 3. Execute: validates and performs assignment
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

    // Authenticate request
    const { user, error: authError } = await authenticateRequest(request, env);
    if (authError) return authError;

    // Verify user authorization
    if (!user) {
      return Response.json({ ok: false, reasons: ["Unauthorized"] }, { status: 401 });
    }

    // Parse request body
    const { body, error: parseError } = await parseRequestBody(request);
    if (parseError) return parseError;
    if (!body) return Response.json({ ok: false, reasons: ["Invalid request body"] }, { status: 400 });

    // Validate body fields
    const validationError = validateBodyFields(body);
    if (validationError) return validationError;

    const { userId, issueUrl, mode = "validate", recommend } = body;

    // Apply rate limiting
    const rateLimitError = applyRateLimit(request, userId, mode);
    if (rateLimitError) return rateLimitError;

    // Extract user access token
    const { token: userAccessToken, error: tokenError } = extractUserAccessToken(body, user);
    if (tokenError) return tokenError;
    if (!userAccessToken) return Response.json({ ok: false, reasons: ["Missing user access token"] }, { status: 401 });

    // Build context
    const context = await buildShallowContextObject({ env, userAccessToken });

    // Route to appropriate handler
    if (!issueUrl) {
      return await handleRecommendations({ context, options: recommend });
    }

    return await handleValidateOrExecute({ context, mode, issueUrl });
  } catch (error) {
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
 * Returns null in development mode or if JWT verification succeeds.
 */
async function authenticateRequest(request: Request, env: Env): Promise<{ user: User | null; error: Response | null }> {
  const jwt = extractJwtFromHeader(request);
  const isDev = isDevelopment();

  if (!jwt && !isDev) {
    return {
      user: null,
      error: Response.json({ ok: false, reasons: ["Missing Authorization header"] }, { status: 401 }),
    };
  }

  if (isDev) {
    console.log("Development mode: Bypassing JWT verification");
    return { user: null, error: null };
  }

  if (jwt) {
    const user = await verifySupabaseJwt(env, jwt);
    return { user, error: null };
  }

  return { user: null, error: null };
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
 * Extracts the user access token from the body or user metadata.
 */
function extractUserAccessToken(body: StartBody, user: User | null): { token: string | null; error: Response | null } {
  if (body.userAccessToken) {
    return { token: body.userAccessToken, error: null };
  }

  if (user) {
    const { access_token } = user.user_metadata as { access_token?: string };
    if (access_token) {
      return { token: access_token, error: null };
    }
  }

  return {
    token: null,
    error: Response.json({ ok: false, reasons: ["Missing user access token"] }, { status: 401 }),
  };
}

/**
 * Handles errors and returns an appropriate response.
 */
function handleError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Internal error";
  const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
  return Response.json({ ok: false, reasons: [message] }, { status });
}
