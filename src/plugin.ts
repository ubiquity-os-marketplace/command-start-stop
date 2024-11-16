import { commandHandler, userPullRequest, userSelfAssign, userStartStop, userUnassigned } from "./handlers/user-start-stop";
import { Context } from "./types";
import { listOrganizations } from "./utils/list-organizations";
import { HttpStatusCode } from "./handlers/result-types";
import { createAdapters } from "./adapters";
import { createClient } from "@supabase/supabase-js";

export async function startStopTask(context: Context) {
  context.adapters = createAdapters(createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY), context as Context);
  const organizations = await listOrganizations(context);
  context.organizations = organizations;

  if (context.command) {
    return await commandHandler(context);
  }

  switch (context.eventName) {
    case "issue_comment.created":
      return await userStartStop(context as Context<"issue_comment.created">);
    case "issues.assigned":
      return await userSelfAssign(context as Context<"issues.assigned">);
    case "pull_request.opened":
      return await userPullRequest(context as Context<"pull_request.opened">);
    case "pull_request.edited":
      return await userPullRequest(context as Context<"pull_request.edited">);
    case "issues.unassigned":
      return await userUnassigned(context as Context<"issues.unassigned">);
    default:
      context.logger.error(`Unsupported event: ${context.eventName}`);
      return { status: HttpStatusCode.BAD_REQUEST };
  }
}
