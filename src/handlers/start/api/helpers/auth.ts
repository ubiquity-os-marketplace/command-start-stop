import { createClient } from "@supabase/supabase-js";
import { Env } from "../../../../types/env";
import { isDevelopment } from "../../../../utils/is-dev-env";

/**
 * Verifies Supabase JWT token.
 * In development mode, bypasses verification and returns a mock user.
 */
export async function verifySupabaseJwt(env: Env, jwt: string) {
  if (isDevelopment()) {
    // Bypass JWT verification in development
    return {
      id: "dev-user-id",
      email: "dev@example.com",
      user_metadata: {},
      app_metadata: {},
    };
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    throw new Error("Unauthorized");
  }
  return data.user;
}

/**
 * Resolves GitHub login from Supabase issues cache.
 * In development mode, allows fallback to a static login from env or returns null.
 */
export async function resolveLoginFromSupabaseIssues(env: Env, userId: number): Promise<string | null> {
  if (isDevelopment()) {
    // In development, allow using a static login from env or return null to use fallback
    const devLogin = process.env.DEV_GITHUB_LOGIN;
    if (devLogin) {
      return devLogin;
    }
    // If no DEV_GITHUB_LOGIN is set, return null to allow fallback handling
    return null;
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data } = await supabase.from("issues").select("payload").eq("author_id", userId).order("modified_at", { ascending: false }).limit(1);
  const payload = data && data[0]?.payload;
  return payload?.user?.login ?? null;
}
