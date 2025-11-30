import { Context } from "../../../types/index";
import { getAssignmentPeriods } from "../../../utils/get-assignment-periods";
import { getUserRoleAndTaskLimit } from "../../../utils/get-user-task-limit-and-role";
import { getAssignedIssues, getOwnerRepoFromHtmlUrl, getPendingOpenedPullRequests } from "../../../utils/issue";
import { ERROR_MESSAGES } from "./error-messages";

async function hasUserBeenUnassigned(context: Context, username: string): Promise<boolean> {
  if ("issue" in context.payload) {
    const { number, html_url } = context.payload.issue;
    const { owner, repo } = getOwnerRepoFromHtmlUrl(html_url);
    const assignmentPeriods = await getAssignmentPeriods(context.octokit, { owner, repo, issue_number: number });
    return assignmentPeriods[username]?.some((period) => period.reason === "bot" || period.reason === "admin");
  }

  return false;
}

export async function handleTaskLimitChecks({
  context,
  logger,
  sender,
  username,
  roleAndLimit,
}: {
  username: string;
  context: Context & { installOctokit: Context["octokit"] };
  logger: Context["logger"];
  sender: string;
  roleAndLimit?: { role: string; limit: number };
}) {
  // Check for unassignment first - this should take precedence over task limit
  if (await hasUserBeenUnassigned(context, username)) {
    throw logger.warn(ERROR_MESSAGES.UNASSIGNED.replace("{{username}}", username), { username });
  }

  const openedPullRequests = (await getPendingOpenedPullRequests(context, username)) || [];
  const assignedIssues = (await getAssignedIssues(context, username)) || [];

  const { limit, role } = roleAndLimit || (await getUserRoleAndTaskLimit(context, username));

  const isWithinLimit = Math.abs(assignedIssues.length - openedPullRequests.length) < limit;

  // check for max and enforce max
  if (!isWithinLimit) {
    const errorMessage = username === sender ? ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX : `${username} ${ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX}`;
    logger.error(errorMessage, {
      assignedIssues: assignedIssues.length,
      openedPullRequests: openedPullRequests.length,
      limit,
    });
  }

  return {
    isWithinLimit,
    assignedIssues,
    openedPullRequests,
    role,
  };
}
