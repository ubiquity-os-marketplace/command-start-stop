import { HttpStatusCode, Result } from "../../types/result-types";
import { Context, Label } from "../../types";
import { getTimeValue, addAssignees } from "../../utils/issue";
import { ERROR_MESSAGES } from "./helpers/error-messages";
import { checkTaskStale } from "./helpers/check-task-stale";
import { generateAssignmentComment } from "./helpers/generate-assignment-comment";
import { getUserIds } from "./helpers/get-user-ids";
import structuredMetadata from "./helpers/generate-structured-metadata";
import { assignTableComment } from "./helpers/generate-assignment-table";

export async function performAssignment(context: Context<"issue_comment.created">, toAssign: string[]): Promise<Result> {
  const {
    logger,
    payload: { issue, sender },
  } = context;
  // compute metadata
  let commitHash: string | null = null;
  try {
    const hashResponse = await context.octokit.rest.repos.getCommit({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      ref: context.payload.repository.default_branch,
    });
    commitHash = hashResponse.data.sha;
  } catch (e) {
    logger.error("Error while getting commit hash", { error: e as Error });
  }
  const labels = issue.labels ?? [];
  const priceLabel = labels.find((label: Label) => {
    return (typeof label === "string" ? label : label.name)?.startsWith("Price: ");
  });
  const isTaskStale = checkTaskStale(getTimeValue(context.config.taskStaleTimeoutDuration), issue.created_at);
  const toAssignIds = await getUserIds(context, toAssign);
  const assignmentComment = await generateAssignmentComment(context, issue.created_at, issue.number, sender.id, null);
  const logMessage = logger.info(ERROR_MESSAGES.TASK_ASSIGNED, {
    taskDeadline: assignmentComment.deadline,
    taskAssignees: toAssignIds,
    priceLabel,
    revision: commitHash?.substring(0, 7),
  });
  const metadata = structuredMetadata.create("Assignment", logMessage);

  await addAssignees(context, issue.number, toAssign);

  await context.commentHandler.postComment(
    context,
    logger.ok(
      [
        assignTableComment({
          isTaskStale,
          daysElapsedSinceTaskCreation: assignmentComment.daysElapsedSinceTaskCreation,
          taskDeadline: assignmentComment.deadline,
          registeredWallet: assignmentComment.registeredWallet,
        }),
        assignmentComment.tips,
        metadata,
      ].join("\n") as string
    ),
    { raw: true }
  );

  return { content: ERROR_MESSAGES.TASK_ASSIGNED, status: HttpStatusCode.OK };
}
