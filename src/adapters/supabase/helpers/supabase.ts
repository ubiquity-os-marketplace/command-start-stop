import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../../../types/context";
import { ShallowContext } from "../../../handlers/start/api/helpers/context-builder";

export class Super {
  protected supabase: SupabaseClient;
  protected context: Context | ShallowContext;

  constructor(supabase: SupabaseClient, context: Context | ShallowContext) {
    this.supabase = supabase;
    this.context = context;
  }
}
