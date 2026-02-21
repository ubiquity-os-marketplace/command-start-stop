import { Repository } from "@octokit/graphql-schema";
import { Context } from "../types/context";
import { HttpStatusCode, Result } from "../types/result-types";
import { QUERY_CLOSING_ISSUE_REFERENCES } from "../utils/get-closing-issue-references";
import { closePullRequest, getOwnerRepoFromHtmlUrl } from "../utils/issue";
import { createRepoOctokit } from "./start/api/helpers/octokit";
import { startTask } from "./start-task";

export async function newPullRequestOrEdit(context: Context<"pull_request.opened" | "pull_request.edited">): Promise<Result> {
  const { payload } = context;
  const { pull_request } = payload;
  const { owner, repo } = getOwnerRepoFromHtmlUrl(pull_request.html_url);
  const linkedIssues = await context.octokit.graphql.paginate<{ repository: Repository }>(QUERY_CLOSING_ISSUE_REFERENCES, {
    owner,
    repo,
    issue_number: pull_request.number,
  });
  const issues = linkedIssues.repository.pullRequest?.closingIssuesReferences?.nodes;
  if (!issues) {
    context.logger.debug("No linked issues were found, nothing to do.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }

  for (const issue of issues) {
    if (!issue || issue.assignees.nodes?.length) {
      continue;
    }

    const repoOctokit = await createRepoOctokit(context.env, issue.repository.owner.login, issue.repository.name);

    const linkedIssue = (
      await repoOctokit.rest.issues.get({
        owner: issue.repository.owner.login,
        repo: issue.repository.name,
        issue_number: issue.number,
      })
    ).data as Context<"issue_comment.created">["payload"]["issue"];

    const repository = (
      await repoOctokit.rest.repos.get({
        owner: issue.repository.owner.login,
        repo: issue.repository.name,
      })
    ).data as Context<"issue_comment.created">["payload"]["repository"];
    let organization: Context<"issue_comment.created">["payload"]["organization"] | undefined = undefined;
    if (repository.owner.type === "Organization") {
      organization = (
        await repoOctokit.rest.orgs.get({
          org: issue.repository.owner.login,
        })
      ).data;
    }
    if (!pull_request.user) {
      context.logger.debug("Pull request has no user associated, skipping.");
      continue;
    }

    const newContext = {
      ...context,
      eventName: "issue_comment.created" as const,
      octokit: repoOctokit,
      payload: {
        ...(context.payload as unknown as Context<"issue_comment.created">["payload"]),
        issue: linkedIssue,
        repository,
        organization,
        sender: pull_request.user,
      },
    } satisfies Context<"issue_comment.created">;
    try {
      return await startTask(newContext);
    } catch (error) {
      await closePullRequest(context, { number: pull_request.number });
      throw error;
    }
  }
  return { status: HttpStatusCode.NOT_MODIFIED };
}
