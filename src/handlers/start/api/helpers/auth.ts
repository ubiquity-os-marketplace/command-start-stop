import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Logs } from "../../../../types/context";
import { Env } from "../../../../types/env";
import { isInstallationToken } from "../../../../utils/token";
import { DatabaseUser } from "./types";

/**
 * Verifies JWT token, Supabase and GitHub are supported.
 */
export async function verifyJwt({ env, jwt, logger }: { env: Env; jwt: string; logger: Logs }): Promise<(DatabaseUser & { accessToken: string }) | null> {
  const trimmedJwt = jwt.trim();

  if (!trimmedJwt) {
    throw logger.error("Unauthorized: Empty JWT");
  }

  const supabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  let user: DatabaseUser & { accessToken: string };

  function isValidGitAccessToken(token: string) {
    return token.startsWith("ghu_") || token.startsWith("ghs_") || token.startsWith("gho_");
  }

  const isValidGithubOrOauthToken = isValidGitAccessToken(trimmedJwt);

  if (isValidGithubOrOauthToken) {
    user = await verifyGitHubToken({ supabase, token: trimmedJwt, logger });
  } else {
    user = await verifySupabaseToken({ supabase, token: trimmedJwt, logger });
  }

  return user;
}

async function verifyGitHubToken({
  supabase,
  token,
  logger,
}: {
  supabase: SupabaseClient;
  token: string;
  logger: Logs;
}): Promise<DatabaseUser & { accessToken: string }> {
  try {
    if (isInstallationToken(token)) {
      logger.info("Received an installation token, will use as is");
      return { accessToken: token, wallet_id: null, location_id: null, id: crypto.createHash("sha256").update(token).digest("hex").substring(0, 16) };
    }

    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.users.getAuthenticated();

    const { data: dbUser, error } = await supabase.from("users").select("*").eq("id", user.id).single();

    if (error || !dbUser) {
      throw logger.error("GitHub token verification failed", { e: String(error) });
    }

    // Handle case where Supabase returns an array instead of a single object (test mocks)
    const userData = Array.isArray(dbUser) ? dbUser[0] : dbUser;
    if (!userData || !userData.id) {
      throw logger.error("GitHub token verification failed: Invalid user data");
    }

    return { ...userData, accessToken: token };
  } catch (error) {
    throw logger.error("GitHub authentication failed", { e: String(error) });
  }
}

async function verifySupabaseToken({
  supabase,
  token,
  logger,
}: {
  supabase: SupabaseClient;
  token: string;
  logger: Logs;
}): Promise<DatabaseUser & { accessToken: string }> {
  const { data: userOauthData, error } = await supabase.auth.getUser(token);

  if (error || !userOauthData?.user) {
    throw logger.error("Supabase authentication failed: Invalid JWT, expired, or user not found", { e: String(error) });
  }

  const userGithubId = userOauthData.user.user_metadata?.provider_id;
  if (!userGithubId) {
    throw logger.error("Supabase authentication failed: User GitHub ID not found in OAuth metadata");
  }

  const { data: dbUser, error: dbError } = await supabase.from("users").select("*").eq("id", userGithubId).single();

  if (dbError || !dbUser) {
    throw logger.error("Supabase authentication failed: User not found in database", { e: String(dbError) });
  }

  // Handle case where Supabase returns an array instead of a single object (test mocks)
  const userData = Array.isArray(dbUser) ? dbUser[0] : dbUser;
  if (!userData || !userData.id) {
    throw logger.error("Supabase authentication failed: Invalid user data");
  }

  return { ...userData, accessToken: token } as DatabaseUser & { accessToken: string };
}

/**
 * Extracts JWT token from Authorization header.
 * Returns null if header is missing or malformed.
 */
export function extractJwtFromHeader(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return auth.split(" ")[1];
}
