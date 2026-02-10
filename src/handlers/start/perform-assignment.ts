import { Context } from "../../types/context";
import { Label } from "../../types/payload";
import { HttpStatusCode, Result } from "../../types/result-types";
import { addAssignees } from "../../utils/issue";
import { StartEligibilityResult } from "./api/helpers/types";
import { ERROR_MESSAGES } from "./helpers/error-messages";
import { generateAssignmentComment } from "./helpers/generate-assignment-comment";
import { assignTableComment } from "./helpers/generate-assignment-table";
import structuredMetadata from "./helpers/generate-structured-metadata";
import { getUserIds } from "./helpers/get-user-ids";

export async function performAssignment(
  context: Context<"issue_comment.created"> & { installOctokit: Context["octokit"] },
  eligibility: StartEligibilityResult
): Promise<Result> {
  const {
    logger,
    payload: { issue, sender },
  } = context;
  const {
    computed: { toAssign = [] },
  } = eligibility;

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
  const toAssignIds = await getUserIds(context, toAssign);
  const assignmentComment = await generateAssignmentComment({
    context,
    issueCreatedAt: issue.created_at,
    issueNumber: issue.number,
    senderId: sender.id,
    eligibility,
  });
  const logMessage = logger.ok(ERROR_MESSAGES.TASK_ASSIGNED, {
    taskDeadline: assignmentComment.deadline,
    taskAssignees: toAssignIds,
    priceLabel,
    revision: commitHash?.substring(0, 7),
  });
  const metadata = structuredMetadata.create("Assignment", logMessage);

  await addAssignees(context, issue.number, toAssign);
  await context.commentHandler.postComment(
    {
      ...context,
      octokit: context.installOctokit,
    },
    logger.ok(
      [
        assignTableComment({
          taskDeadline: assignmentComment.deadline,
          registeredWallet: assignmentComment.registeredWallet,
          warnings: assignmentComment.warnings,
        }),
        assignmentComment.tips,
        metadata,
      ].join("\n") as string
    ),
    { raw: true }
  );

  return { content: ERROR_MESSAGES.TASK_ASSIGNED, status: HttpStatusCode.OK };
}
