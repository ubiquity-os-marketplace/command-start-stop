import { SupabaseClient } from "@supabase/supabase-js";

import { ShallowContext } from "../../../handlers/start/api/helpers/context-builder";
import { Context } from "../../../types/context";

export class Super {
  protected supabase: SupabaseClient;
  protected context: Context | ShallowContext;

  constructor(supabase: SupabaseClient, context: Context | ShallowContext) {
    this.supabase = supabase;
    this.context = context;
  }
}
