import { Context } from "../../../types/index";
import { getAssignedIssues, getOwnerRepoFromHtmlUrl, getPendingOpenedPullRequests } from "../../../utils/issue";
import { getAssignmentPeriods } from "../../../utils/get-assignment-periods";
import { getUserRoleAndTaskLimit } from "../../../utils/get-user-task-limit-and-role";
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
}: {
  username: string;
  context: Context;
  logger: Context["logger"];
  sender: string;
}) {
  // Check for unassignment first - this should take precedence over task limit
  if (await hasUserBeenUnassigned(context, username)) {
    throw logger.warn(ERROR_MESSAGES.UNASSIGNED.replace("{{username}}", username), { username });
  }

  const openedPullRequests = await getPendingOpenedPullRequests(context, username);
  const assignedIssues = await getAssignedIssues(context, username);
  const { limit, role } = await getUserRoleAndTaskLimit(context, username);

  // check for max and enforce max
  if (Math.abs(assignedIssues.length - openedPullRequests.length) >= limit) {
    const errorMessage = username === sender ? ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX : `${username} ${ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX}`;
    logger.error(errorMessage, {
      assignedIssues: assignedIssues.length,
      openedPullRequests: openedPullRequests.length,
      limit,
    });

    return {
      isWithinLimit: false,
      issues: assignedIssues,
    };
  }

  return {
    isWithinLimit: true,
    issues: [],
    role,
  };
}
