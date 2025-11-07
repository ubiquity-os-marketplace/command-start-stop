import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../types/context";
import { User } from "./supabase/helpers/user";
import { ShallowContext } from "../handlers/start/api/helpers/context-builder";

export function createAdapters(supabaseClient: SupabaseClient, context: Context | ShallowContext) {
  return {
    supabase: {
      user: new User(supabaseClient, context),
    },
  };
}
