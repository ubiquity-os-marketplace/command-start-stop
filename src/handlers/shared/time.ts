import { Context, isIssueCommentEvent } from "../../types/context";
import { addLabels, removeLabel } from "../../utils/issue";
import { findClosestTimeLabel } from "../../utils/time-labels";
import { HttpStatusCode } from "../result-types";
import { getTransformedRole, getUserRoleAndTaskLimit } from "./get-user-task-limit-and-role";

export async function setTimeLabel(context: Context, timeInput: string, issueNumber: number) {
  if (!isIssueCommentEvent(context)) {
    throw context.logger.warn("This command can only be used in issue comments");
  }
  const { logger, payload } = context;

  const sender = payload.sender.login;
  const issueAuthor = payload.issue.user.login;
  const userAssociation = await getUserRoleAndTaskLimit(context, sender);
  const userRole = getTransformedRole(userAssociation.role);
  const isAdmin = userRole === "admin";
  const isAuthor = sender === issueAuthor;

  if (!isAdmin && !isAuthor) {
    throw logger.warn("Only admins or the issue author can set time estimates.");
  }

  try {
    const timeLabel = await findClosestTimeLabel(context, timeInput);
    const currentLabels = payload.issue.labels.map((label) => label.name);
    const timeLabels = currentLabels.filter((label: string) => label.startsWith("Time:"));

    for (const label of timeLabels) {
      await removeLabel(context, issueNumber, label);
    }
    await addLabels(context, issueNumber, [timeLabel]);
  } catch (error) {
    throw logger.error("Failed to set the time label.", { error: error as Error });
  }
}

export async function time(context: Context, issue: Context<"issue_comment.created">["payload"]["issue"], timeInput: string) {
  await setTimeLabel(context, timeInput, issue.number);
  return { content: "Time was set to the task.", status: HttpStatusCode.OK };
}
