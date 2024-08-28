import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import { LogReturn, Logs } from "@ubiquity-dao/ubiquibot-logger";
import { createAdapters } from "./adapters";
import { userStartStop } from "./handlers/user-start-stop";
import { Context, Env, PluginInputs } from "./types";
import { addCommentToIssue } from "./utils/issue";

export async function startStopTask(inputs: PluginInputs, env: Env) {
  const octokit = new Octokit({ auth: inputs.authToken });
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    env,
    logger: new Logs("info"),
    adapters: {} as ReturnType<typeof createAdapters>,
  };

  context.adapters = createAdapters(supabase, context);

  if (context.eventName === "issue_comment.created") {
    try {
      return await userStartStop(context);
    } catch (err) {
      let errorMessage;
      if (err instanceof LogReturn) {
        errorMessage = err;
      } else if (err instanceof Error) {
        errorMessage = context.logger.error(err.message, { error: err });
      } else {
        errorMessage = context.logger.error("An error occurred", { err });
      }
      await addCommentToIssue(context, `${errorMessage?.logMessage.diff}\n<!--\n${sanitizeMetadata(errorMessage?.metadata)}\n-->`);
    }
  } else {
    context.logger.error(`Unsupported event: ${context.eventName}`);
  }
}

function sanitizeMetadata(obj: LogReturn["metadata"]): string {
  return JSON.stringify(obj, null, 2).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/--/g, "&#45;&#45;");
}
