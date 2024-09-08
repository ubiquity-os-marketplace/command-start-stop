import { Context, isContextCommentCreated } from "../types";
import { addCommentToIssue } from "../utils/issue";
import { HttpStatusCode, Result } from "./result-types";
import { getDeadline } from "./shared/generate-assignment-comment";
import { start } from "./shared/start";
import { stop } from "./shared/stop";

export async function userStartStop(context: Context): Promise<Result> {
  if (!isContextCommentCreated(context)) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { payload } = context;
  const { issue, comment, sender, repository } = payload;
  const slashCommand = comment.body.split(" ")[0].replace("/", "");
  const teamMates = comment.body
    .split("@")
    .slice(1)
    .map((teamMate) => teamMate.split(" ")[0]);

  if (slashCommand === "stop") {
    return await stop(context, issue, sender, repository);
  } else if (slashCommand === "start") {
    return await start(context, issue, sender, teamMates);
  }

  return { status: HttpStatusCode.NOT_MODIFIED };
}

export async function userSelfAssign(context: Context): Promise<Result> {
  const { payload } = context;
  const { issue } = payload;
  const deadline = getDeadline(issue);

  if (!deadline) {
    context.logger.debug("Skipping deadline posting message because no deadline has been set.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }

  const users = issue.assignees.map((user) => `@${user?.login}`).join(", ");

  await addCommentToIssue(context, `${users} the deadline is at ${deadline}`);
  return { status: HttpStatusCode.OK };
}
