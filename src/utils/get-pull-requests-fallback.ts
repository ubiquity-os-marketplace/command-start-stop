import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { Context, PrState } from "../types/index";

function isHttpError(error: unknown): error is { status: number; message: string } {
  return typeof error === "object" && error !== null && "status" in error && "message" in error;
}

/**
 * Fetches all open pull requests within a specified organization created by a particular user.
 * This method is slower than using a search query but should work even if the user has his activity set to private.
 */
export async function getAllPullRequestsFallback(context: Context, state: PrState, username: string) {
  const { octokit, logger } = context;
  const owner = context.payload.repository.owner.login;

  try {
    // Check if the owner is an organization or a user. This will affect how we retrieve the repository list.
    const ownerInfo = await context.octokit.rest.users.getByUsername({ username: owner });
    const isOrganization = ownerInfo.data.type === "Organization";

    let repositories;

    if (isOrganization) {
      repositories = await context.octokit.paginate(context.octokit.rest.repos.listForOrg, {
        org: owner,
        type: "all",
        per_page: 100,
      });
    } else {
      repositories = await context.octokit.paginate(context.octokit.rest.repos.listForUser, {
        username: owner,
        type: "all",
        per_page: 100,
      });
    }

    const allPrs: RestEndpointMethodTypes["pulls"]["list"]["response"]["data"] = [];

    const tasks = repositories.map(async (repo) => {
      try {
        const prs = await octokit.paginate(octokit.rest.pulls.list, {
          owner,
          repo: repo.name,
          state,
          per_page: 100,
        });
        const userPrs = prs.filter((pr) => pr.user?.login === username);
        allPrs.push(...userPrs);
      } catch (error) {
        if (isHttpError(error) && (error.status === 404 || error.status === 403)) {
          logger.error(`Could not find pull requests for repository ${repo.url}, skipping: ${error}`);
          return;
        }
        logger.fatal("Failed to fetch pull requests for repository", { error: error as Error });
        throw error;
      }
    });

    await Promise.all(tasks);

    return allPrs;
  } catch (error) {
    logger.fatal("Failed to fetch pull requests for organization", { error: error as Error });
    throw error;
  }
}

export async function getAssignedIssuesFallback(context: Context, username: string) {
  const org = context.payload.repository.owner.login;
  const assignedIssues = [];

  try {
    const repositories = await context.octokit.paginate(context.octokit.rest.repos.listForOrg, {
      org,
      type: "all",
      per_page: 100,
    });

    for (const repo of repositories) {
      const issues = await context.octokit.paginate(context.octokit.rest.issues.listForRepo, {
        owner: org,
        repo: repo.name,
        assignee: username,
        state: "open",
        per_page: 100,
      });

      assignedIssues.push(
        ...issues.filter(
          (issue) =>
            issue.pull_request === undefined && (issue.assignee?.login === username || issue.assignees?.some((assignee) => assignee.login === username))
        )
      );
    }

    return assignedIssues;
  } catch (err: unknown) {
    throw new Error(context.logger.error("Fetching assigned issues failed!", { error: err as Error }).logMessage.raw);
  }
}
