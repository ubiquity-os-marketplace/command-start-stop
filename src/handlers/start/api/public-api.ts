import { Env } from "../../../types/env";
import { HttpStatusCode } from "../../../types/result-types";
import { evaluateStartEligibility } from "../evaluate-eligibility";
import { performAssignment } from "../perform-assignment";
import { verifySupabaseJwt, resolveLoginFromSupabaseIssues } from "./helpers/auth";
import { rateLimit, getClientId } from "./helpers/rate-limit";
import { parseIssueUrl } from "./helpers/parsers";
import { buildContext } from "./helpers/context-builder";
import { getRecommendations } from "./helpers/recommendations";
import { StartBody } from "./helpers/types";

/**
 * Handles the recommendation flow when no issueUrl is provided.
 * Uses embeddings to find similar issues based on user's prior work.
 */
async function handleRecommendations(env: Env, userId: number, recommend?: { topK?: number; threshold?: number }): Promise<Response> {
  try {
    const recommendations = await getRecommendations(env, userId, recommend);

    if (recommendations.length === 0) {
      return Response.json({ ok: true, recommendations: [], note: "No prior embeddings found for user" }, { status: 200 });
    }

    return Response.json({ ok: true, recommendations }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embeddings search failed";
    return Response.json({ ok: false, reasons: [message] }, { status: 500 });
  }
}

/**
 * Handles the validate or execute flow for a specific issue.
 * Validates eligibility and optionally performs assignment.
 */
async function handleValidateOrExecute(
  env: Env,
  issueUrl: string,
  userId: number,
  teammates: string[],
  mode: "validate" | "execute",
  loginFromBody?: string
): Promise<Response> {
  const { owner, repo, issue_number } = parseIssueUrl(issueUrl);

  // Resolve sender login from Supabase issues cache
  let senderLogin = await resolveLoginFromSupabaseIssues(env, userId);

  // In development, allow fallback to login from request body
  if (!senderLogin && loginFromBody) {
    senderLogin = loginFromBody;
  }

  if (!senderLogin) {
    return Response.json({ ok: false, reasons: ["Unable to resolve GitHub login for userId. Provide 'login' in request body."] }, { status: 400 });
  }

  // Build context
  const context = await buildContext(env, owner, repo, issue_number, senderLogin, userId);
  const issue = context.payload.issue;
  const sender = context.payload.sender;

  // Evaluate eligibility
  const preflight = await evaluateStartEligibility(context, issue, sender, teammates);

  if (mode === "validate") {
    const status = preflight.ok ? 200 : 400;
    return Response.json(
      {
        ok: preflight.ok,
        reasons: preflight.errors.map((e) => e.logMessage.raw),
        warnings: preflight.warnings,
        computed: preflight.computed,
        assignedIssues: preflight.computed.assignedIssues,
      },
      { status }
    );
  }

  // Execute mode - check eligibility first
  if (!preflight.ok) {
    return Response.json(
      {
        ok: false,
        reasons: preflight.errors.map((e) => e.logMessage.raw),
        warnings: preflight.warnings,
        assignedIssues: preflight.computed.assignedIssues,
        computed: preflight.computed,
      },
      { status: 400 }
    );
  }

  // Perform assignment
  try {
    const result = await performAssignment(context, issue, sender, preflight.computed.toAssign);
    return Response.json(
      {
        ok: result.status === HttpStatusCode.OK,
        content: result.content,
        metadata: preflight.computed,
      },
      { status: 200 }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Start failed";
    return Response.json({ ok: false, reasons: [reason] }, { status: 400 });
  }
}

/**
 * Extracts JWT token from Authorization header.
 * Returns null if header is missing or malformed.
 */
function extractJwtFromHeader(request: Request): string | null {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return auth.split(" ")[1];
}

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
    // Method check
    if (request.method !== "POST") {
      return new Response(null, { status: 405 });
    }

    // Authentication
    const jwt = extractJwtFromHeader(request);
    const isDev = true; // Hardcoded for development testing

    if (!jwt && !isDev) {
      return Response.json({ ok: false, reasons: ["Missing Authorization header"] }, { status: 401 });
    }

    // Only verify JWT if provided (in dev, jwt can be optional)
    if (jwt) {
      await verifySupabaseJwt(env, jwt);
    }

    // Parse and validate body
    let body: StartBody;
    try {
      body = (await request.json()) as StartBody;
    } catch {
      return Response.json({ ok: false, reasons: ["Invalid JSON body"] }, { status: 400 });
    }

    const { userId, issueUrl, teammates = [], mode = "validate", recommend, login } = body;
    if (!userId) {
      return Response.json({ ok: false, reasons: ["userId is required"] }, { status: 400 });
    }

    // Rate limiting
    const clientId = getClientId(request);
    const key = `${clientId}|${userId}|${mode}`;
    const limit = mode === "execute" ? 3 : 10;
    const rl = rateLimit(key, limit, 60_000);
    if (!rl.allowed) {
      return Response.json({ ok: false, reasons: ["Rate limit exceeded"], resetAt: rl.resetAt }, { status: 429 });
    }

    // Route to appropriate handler
    if (!issueUrl) {
      return await handleRecommendations(env, userId, recommend);
    }

    return await handleValidateOrExecute(env, issueUrl, userId, teammates, mode, login);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return Response.json({ ok: false, reasons: [message] }, { status });
  }
}
