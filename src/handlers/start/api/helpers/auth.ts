import { createClient, User } from "@supabase/supabase-js";
import { Env } from "../../../../types/env";
import { ShallowContext } from "./context-builder";

/**
 * Verifies Supabase JWT token.
 */
export async function verifySupabaseJwt(env: Env, jwt: string): Promise<User> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    throw new Error("Unauthorized");
  }
  return data.user;
}

/**
 * Resolves GitHub login from Supabase issues cache.
 */
export async function resolveLoginFromSupabaseIssues(context: ShallowContext, userId: number): Promise<string | null> {
  const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);
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
