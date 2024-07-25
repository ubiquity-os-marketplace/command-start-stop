import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { createAdapters } from "./adapters";
import { userStartStop } from "./handlers/user-start-stop";
import { Context, Env, PluginInputs } from "./types";

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
    await userStartStop(context);
  } else {
    context.logger.error(`Unsupported event: ${context.eventName}`);
  }
}
