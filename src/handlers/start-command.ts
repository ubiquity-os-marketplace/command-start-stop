import { Context, isIssueCommentEvent } from "../types/index";
import { HttpStatusCode, Result } from "../types/result-types";
import { startTask } from "./start-task";
import { stop } from "./stop-task";

export async function commandHandler(context: Context): Promise<Result> {
  if (!isIssueCommentEvent(context)) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  if (!context.command) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { issue, sender, repository } = context.payload;

  if (context.command.name === "stop") {
    return await stop(context, issue, sender, repository);
  } else if (context.command.name === "start") {
    const teammates = context.command.parameters.teammates ?? [];
    return await startTask(context, issue, sender, teammates);
  } else {
    return { status: HttpStatusCode.BAD_REQUEST };
  }
}

export async function userStartStop(context: Context): Promise<Result> {
  if (!isIssueCommentEvent(context)) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { issue, comment, sender, repository } = context.payload;
  const slashCommand = comment.body.trim().split(" ")[0].replace("/", "");
  const teamMates = comment.body
    .split("@")
    .slice(1)
    .map((teamMate) => teamMate.split(" ")[0]);

  if (slashCommand === "stop") {
    return await stop(context, issue, sender, repository);
  } else if (slashCommand === "start") {
    return await startTask(context, issue, sender, teamMates);
  }

  return { status: HttpStatusCode.NOT_MODIFIED };
}
