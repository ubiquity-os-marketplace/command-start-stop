import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../types/context";
import { User } from "./supabase/helpers/user";

export function createAdapters(supabaseClient: SupabaseClient, context: Context) {
  return {
    supabase: {
      user: new User(supabaseClient, context),
    },
  };
}
