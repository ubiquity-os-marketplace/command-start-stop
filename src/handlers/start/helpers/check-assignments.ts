import { Context } from "../../../types/context";
import { getAssignmentPeriods } from "../../../utils/get-assignment-periods";
import { getUserRoleAndTaskLimit } from "../../../utils/get-user-task-limit-and-role";
import { getAssignedIssues, getOwnerRepoFromHtmlUrl, getPendingOpenedPullRequests } from "../../../utils/issue";
import { ERROR_MESSAGES } from "./error-messages";

const QUERY_REVIEW_THREADS = /* GraphQL */ `
  query reviewThreads($owner: String!, $repo: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        reviewThreads(first: 100) {
          nodes {
            id
            resolved
            comments(first: 1, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                author { login }
                updatedAt
              }
            }
          }
        }
      }
    }
  }
`;

// 24-hour lag threshold in milliseconds
const REVIEWER_LAG_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * Checks if a user is "reviewer-lagged": they are the last commenter on all
 * unresolved review threads, and the last comment was more than 24 hours ago.
 * In this state the reviewer (not the user) is blocking progress, so the user
 * should be allowed to bypass the task limit.
 */
async function isReviewerLagged(
  context: Context & { installOctokit: Context["octokit"] },
  username: string,
  prOwner: string,
  prRepo: string,
  prNumber: number
): Promise<boolean> {
  try {
    const result = await context.installOctokit.graphql(QUERY_REVIEW_THREADS, {
      owner: prOwner,
      repo: prRepo,
      prNumber,
    }) as any;

    const threads = result?.repository?.pullRequest?.reviewThreads?.nodes || [];
    // Filter to unresolved threads only
    const unresolved = threads.filter((t: any) => !t.resolved);

    // If no unresolved threads, not reviewer-lagged
    if (unresolved.length === 0) return false;

    const now = Date.now();
    for (const thread of unresolved) {
      const lastComment = thread.comments?.nodes?.[0];
      // If no comments in thread, skip
      if (!lastComment) continue;
      // User must be the last commenter
      if (lastComment.author?.login?.toLowerCase() !== username.toLowerCase()) return false;
      // Last comment must be older than 24 hours
      const commentAge = now - new Date(lastComment.updatedAt).getTime();
      if (commentAge < REVIEWER_LAG_TIMEOUT_MS) return false;
    }

    // User is last commenter on all unresolved threads and all are stale
    return true;
  } catch (err) {
    context.logger.debug("isReviewerLagged check failed", { err });
    return false;
  }
}

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
  prForReviewerLag,
}: {
  username: string;
  context: Context & { installOctokit: Context["octokit"] };
  logger: Context["logger"];
  sender: string;
  roleAndLimit?: { role: string; limit: number };
  /** Optional linked PR number to use for reviewer-lag check. */
  prForReviewerLag?: number;
}) {
  const openedPullRequests = (await getPendingOpenedPullRequests(context, username)) || [];
  const assignedIssues = (await getAssignedIssues(context, username)) || [];

  const { limit, role } = roleAndLimit || (await getUserRoleAndTaskLimit(context, username));

  const isWithinLimit = Math.abs(assignedIssues.length - openedPullRequests.length) < limit;

  // Check for unassignment first - this should take precedence over task limit
  if (await hasUserBeenUnassigned(context, username)) {
    logger.warn(ERROR_MESSAGES.UNASSIGNED.replace("{{username}}", username), { username });
    return {
      isUnassigned: true,
      isWithinLimit,
      assignedIssues,
      openedPullRequests,
      role,
    };
  }

  // check for max and enforce max (unless reviewer-lagged)
  let isReviewerLaggedUser = false;
  if (!isWithinLimit && prForReviewerLag !== undefined) {
    const { owner, repo } = { owner: context.payload.repository.owner.login, repo: context.payload.repository.name };
    isReviewerLaggedUser = await isReviewerLagged(context, username, owner, repo, prForReviewerLag);
    if (isReviewerLaggedUser) {
      logger.info(`User ${username} is reviewer-lagged — allowing task limit bypass.`);
    }
  }

  if (!isWithinLimit && !isReviewerLaggedUser) {
    const errorMessage = username === sender ? ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX : `${username} ${ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX}`;
    logger.warn(errorMessage, {
      assignedIssues: assignedIssues.length,
      openedPullRequests: openedPullRequests.length,
      limit,
    });
  }

  return {
    isUnassigned: false,
    isWithinLimit,
    isReviewerLagged: isReviewerLaggedUser,
    assignedIssues,
    openedPullRequests,
    role,
  };
}
