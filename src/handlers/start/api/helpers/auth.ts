import { Octokit } from "@octokit/rest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";

import { Env } from "../../../../types/env";

import { DatabaseUser } from "./types";

/**
 * Verifies Supabase JWT token.
 */
export async function verifySupabaseJwt({
  env,
  jwt,
  logger,
}: {
  env: Env;
  jwt: string;
  logger: Logs;
}): Promise<(DatabaseUser & { accessToken: string }) | null> {
  const trimmedJwt = jwt.trim();

  if (!trimmedJwt) {
    throw new Error("Unauthorized: Empty JWT");
  }

  const supabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  let user: (DatabaseUser & { accessToken: string }) | null = null;

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
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.users.getAuthenticated();

    const { data: dbUser, error } = await supabase.from("users").select("*").eq("id", user.id).single();

    if (error || !dbUser) {
      logger.error("GitHub token verification failed", { e: error });
      throw new Error("Unauthorized: GitHub token not linked to any user");
    }

    return { ...dbUser, accessToken: token };
  } catch (error) {
    logger.error("GitHub authentication failed", { e: error });
    throw new Error("Unauthorized: Invalid GitHub token");
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
    throw new Error("Unauthorized: Invalid JWT, expired, or user not found");
  }

  const userGithubId = userOauthData.user.user_metadata?.provider_id;
  if (!userGithubId) {
    throw new Error("Unauthorized: User GitHub ID not found in OAuth metadata");
  }

  const { data: dbUser, error: dbError } = await supabase.from("users").select("*").eq("id", userGithubId).single();

  if (dbError || !dbUser) {
    logger.error("Supabase token verification failed", { e: dbError });
    throw new Error("Unauthorized: User not found in database");
  }

  return { ...dbUser, accessToken: token } as DatabaseUser & { accessToken: string };
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
