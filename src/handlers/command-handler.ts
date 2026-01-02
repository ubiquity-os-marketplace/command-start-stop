import { Context, isIssueCommentEvent } from "../types/context";
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
    return await startTask(context);
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
    context.command = context.command || {
      name: "start",
      parameters: {
        teammates: teamMates,
      },
    };
    return await startTask(context);
  }

  return { status: HttpStatusCode.NOT_MODIFIED };
}
