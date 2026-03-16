import { Repository } from "@octokit/graphql-schema";
import { QUERY_OPEN_LINKED_PULL_REQUESTS_FOR_ISSUE } from "../github-queries";
import { Context } from "../types/context";

interface GetLinkedParams {
  owner: string;
  repository: string;
  issue?: number;
}

export interface GetLinkedResults {
  organization: string;
  repository: string;
  number: number;
  href: string;
  author: string;
}

export async function getOpenLinkedPullRequestsForIssue(context: Context, { owner, repository, issue }: GetLinkedParams): Promise<GetLinkedResults[]> {
  if (!issue) {
    throw context.logger.error("Issue is not defined");
  }

  const linkedPullRequests = await context.octokit.graphql.paginate<{ repository: Repository | null }>(QUERY_OPEN_LINKED_PULL_REQUESTS_FOR_ISSUE, {
    owner,
    repo: repository,
    issue_number: issue,
  });
  const pullRequests = linkedPullRequests.repository?.issue?.closedByPullRequestsReferences?.nodes;

  if (!pullRequests) {
    return [];
  }

  return pullRequests
    .filter((pullRequest): pullRequest is NonNullable<typeof pullRequest> => !!pullRequest)
    .map((pullRequest) => ({
      organization: pullRequest.repository.owner.login,
      repository: pullRequest.repository.name,
      number: pullRequest.number,
      href: pullRequest.url,
      author: pullRequest.author?.login ?? "",
    }));
}
