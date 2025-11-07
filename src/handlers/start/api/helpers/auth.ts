import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { Env } from "../../../../types/env";
import { ShallowContext } from "./context-builder";
import { Octokit } from "@octokit/rest";
import { StartBody } from "./types";

/**
 * Verifies Supabase JWT token.
 */
export async function verifySupabaseJwt(body: StartBody, env: Env, jwt: string): Promise<{ user: User, accessToken: string | null }> {
  const trimmedJwt = jwt.trim();

  if (!trimmedJwt) {
    throw new Error("Unauthorized: Empty JWT");
  }

  const supabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const accessToken = extractUserAccessToken({ body });

  let user: User;

  function isValidGitAccessToken(token: string) {
    return token.startsWith("ghu_") || token.startsWith("ghs_") || token.startsWith("gho_");
  }

  let isOauthTokenValid, isPayloadTokenValid: boolean;
  isOauthTokenValid = isValidGitAccessToken(trimmedJwt);
  isPayloadTokenValid = accessToken ? isValidGitAccessToken(accessToken) : false;

  if (isPayloadTokenValid && accessToken) {
    user = await verifyGitHubToken(supabase, accessToken);
  } else if (isOauthTokenValid) {
    user = await verifyGitHubToken(supabase, trimmedJwt);
  } else if (trimmedJwt.split(".").length === 3) {
    user = await verifySupabaseToken(supabase, trimmedJwt);
  } else {
    throw new Error("Unauthorized: Malformed JWT");
  }

  return {
    user,
    accessToken,
  }
}

async function verifyGitHubToken(supabase: SupabaseClient, token: string): Promise<User> {
  const octo = new Octokit({ auth: token });
  const { data: user } = await octo.users.getAuthenticated();

  const { data: dbUser, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !dbUser) {
    throw new Error("Unauthorized: GitHub token not linked to any user");
  }

  return { ...dbUser, accessToken: token };
}

async function verifySupabaseToken(supabase: SupabaseClient, token: string): Promise<User> {
  const { data: userOauthData, error } = await supabase.auth.getUser(token);

  if (error || !userOauthData?.user) {
    throw new Error("Unauthorized: Invalid JWT, expired, or user not found");
  }

  const userGithubId = userOauthData.user.user_metadata?.provider_id;
  if (!userGithubId) {
    throw new Error("Unauthorized: User GitHub ID not found in OAuth metadata");
  }

  const { data: dbUser, error: dbError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userGithubId)
    .single();

  if (dbError || !dbUser) {
    throw new Error("Unauthorized: User not found in database");
  }

  return { ...dbUser, accessToken: token };
}

/**
 * Resolves GitHub login from Supabase issues cache.
 */
export async function resolveLoginFromSupabaseIssues(context: ShallowContext, userId: number): Promise<string | null> {
  const supabase: SupabaseClient = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);
  const { data } = await supabase.from("issues").select("payload").eq("author_id", userId).order("modified_at", { ascending: false }).limit(1);
  const payload = data && data[0]?.payload;
  return payload?.user?.login ?? null;
}

/**
 * Extracts JWT token from Authorization header.
 * Returns null if header is missing or malformed.
 */
export function extractJwtFromHeader(request: Request): string | null {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return auth.split(" ")[1];
}



/**
 * Extracts the user access token from the body or user metadata.
 */
function extractUserAccessToken({ body, user }: { body?: StartBody, user?: User | null }): string | null {
  if (body?.userAccessToken) {
    return body.userAccessToken;
  }

  if (user) {
    const { access_token } = user.user_metadata as { access_token?: string };
    if (access_token) {
      return access_token;
    }
  }

  return null;
}