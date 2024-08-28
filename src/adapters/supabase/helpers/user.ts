import { SupabaseClient } from "@supabase/supabase-js";
import { Super } from "./supabase";
import { Context } from "../../../types/context";
import { addCommentToIssue } from "../../../utils/issue";

type Wallet = {
  address: string;
};

export class User extends Super {
  constructor(supabase: SupabaseClient, context: Context) {
    super(supabase, context);
  }

  async getWalletByUserId(userId: number, issueNumber: number) {
    const { data, error } = (await this.supabase.from("users").select("wallets(*)").eq("id", userId).single()) as { data: { wallets: Wallet }; error: unknown };
    if ((error && !data) || !data.wallets?.address) {
      this.context.logger.error("No wallet address found", { userId, issueNumber });
      if (this.context.config.startRequiresWallet) {
        await addCommentToIssue(this.context, "```diff\n! Please set your wallet address with the /wallet command first and try again.\n```");
        throw new Error("No wallet address found");
      } else {
        await addCommentToIssue(this.context, "```diff\n# Please set your wallet address with the /wallet command in order to be eligible for rewards.\n```");
      }
    } else {
      this.context.logger.info("Successfully fetched wallet", { userId, address: data.wallets?.address });
    }

    return data?.wallets?.address || null;
  }
}
