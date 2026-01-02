import { SupabaseClient } from "@supabase/supabase-js";
import { ShallowContext } from "../../../handlers/start/api/helpers/context-builder";
import { Context } from "../../../types/context";
import { Super } from "./supabase";

type Wallet = {
  address: string;
};

export class User extends Super {
  constructor(supabase: SupabaseClient, context: Context | ShallowContext) {
    super(supabase, context);
  }

  async getWalletByUserId(userId: number, issueNumber: number) {
    const { data, error } = (await this.supabase.from("users").select("wallets(*)").eq("id", userId).single()) as { data: { wallets: Wallet }; error: unknown };
    if ((error && !data) || !data.wallets?.address) {
      this.context.logger.warn("No wallet address found", { userId, issueNumber });
      if (this.context.config.startRequiresWallet) {
        throw this.context.logger.warn(this.context.config.emptyWalletText, { userId, issueNumber });
      }
    } else {
      this.context.logger.ok("Successfully fetched wallet", { userId, address: data.wallets?.address });
    }

    return data?.wallets?.address || null;
  }
}
