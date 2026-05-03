import { createClient } from "@supabase/supabase-js";
import { createAdapters } from "./adapters/index";
import { closeUserUnassignedPr } from "./handlers/close-pull-on-unassign";
import { reopenPrOnReassign } from "./handlers/reopen-pr-on-reassign";
import { commandHandler, userStartStop } from "./handlers/command-handler";
import { newPullRequestOrEdit } from "./handlers/new-pull-request-or-edit";
import { Context } from "./types/context";
import { HttpStatusCode } from "./types/result-types";
import { listOrganizations } from "./utils/list-organizations";

export async function startStopTask(context: Context) {
  context.adapters = createAdapters(createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY), context);
  context.organizations = await listOrganizations(context);

  try {
    if (context.command) {
      return await commandHandler(context);
    }

    switch (context.eventName) {
      case "issue_comment.created":
        return await userStartStop(context as Context<"issue_comment.created">);
      case "pull_request.opened":
      case "pull_request.edited":
        return await newPullRequestOrEdit(context as Context<"pull_request.edited">);
      case "issues.unassigned":
        return await closeUserUnassignedPr(context as Context<"issues.unassigned">);
      case "issues.assigned":
        return await reopenPrOnReassign(context as Context<"issues.assigned">);
      default:
        context.logger.warn(`Unsupported event: ${context.eventName}`);
        return { status: HttpStatusCode.BAD_REQUEST };
    }
  } catch (error) {
    throw error instanceof AggregateError ? context.logger.warn(error.errors.map((err) => err.message).join("\n\n"), { error }) : error;
  }
}
