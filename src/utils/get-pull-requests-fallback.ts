import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { Context } from "../types/context";
import { PrState } from "../types/payload";
import { AssignedIssue } from "./issue";

function isHttpError(error: unknown): error is { status: number; message: string } {
  return typeof error === "object" && error !== null && "status" in error && "message" in error;
}

async function getRepositories(context: Context) {
  const owner = context.payload.repository.owner.login;
  let repositories;

  // Check if the owner is an organization or a user. This will affect how we retrieve the repository list.
  const ownerInfo = await context.octokit.rest.users.getByUsername({ username: owner });
  const isOrganization = ownerInfo.data.type === "Organization";

  if (isOrganization) {
    repositories = await context.octokit.paginate(context.octokit.rest.repos.listForOrg, {
      org: owner,
      type: "sources", // excludes forked repos
      per_page: 100,
    });
  } else {
    repositories = await context.octokit.paginate(context.octokit.rest.repos.listForUser, {
      username: owner,
      type: "owner", // excluded non-owned repos
      per_page: 100,
    });
  }

  return repositories;
}

/**
 * Fetches all open pull requests within a specified organization created by a particular user.
 * This method is slower than using a search query but should work even if the user has his activity set to private.
 */
export async function getAllPullRequestsFallback(context: Context, state: PrState, username: string) {
  const { octokit, logger } = context;
  const owner = context.payload.repository.owner.login;

  try {
    const repositories = await getRepositories(context);

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
        throw logger.fatal("Failed to fetch pull requests for repository", { error: error as Error });
      }
    });

    await Promise.all(tasks);

    return allPrs;
  } catch (error) {
    throw logger.fatal("Failed to fetch pull requests for organization", { error: error as Error });
  }
}

export async function getAssignedIssuesFallback(context: Context, username: string): Promise<AssignedIssue[]> {
  const org = context.payload.repository.owner.login;
  const assignedIssues: AssignedIssue[] = [];

  try {
    const repositories = await getRepositories(context);

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
    throw context.logger.error("Fetching assigned issues failed!", { error: err as Error });
  }
}
