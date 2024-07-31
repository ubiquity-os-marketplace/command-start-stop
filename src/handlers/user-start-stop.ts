import { Context } from "../types";
import { start } from "./shared/start";
import { stop } from "./shared/stop";

export async function userStartStop(context: Context): Promise<{ output: string | null }> {
  const { payload } = context;
  const { issue, comment, sender, repository } = payload;
  const slashCommand = comment.body.split(" ")[0].replace("/", "");

  if (slashCommand === "stop") {
    return await stop(context, issue, sender, repository);
  } else if (slashCommand === "start") {
    return await start(context, issue, sender);
  }

  return { output: null };
}
