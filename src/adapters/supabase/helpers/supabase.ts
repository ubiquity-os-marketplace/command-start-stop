import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../../../types/context";

export class Super {
  protected supabase: SupabaseClient;
  protected context: Context;

  constructor(supabase: SupabaseClient, context: Context) {
    this.supabase = supabase;
    this.context = context;
  }
}
