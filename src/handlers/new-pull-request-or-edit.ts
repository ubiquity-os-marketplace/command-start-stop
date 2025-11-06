import { createAppAuth } from "@octokit/auth-app";
import { Repository } from "@octokit/graphql-schema";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Context } from "../types/index";
import { QUERY_CLOSING_ISSUE_REFERENCES } from "../utils/get-closing-issue-references";
import { closePullRequest, getOwnerRepoFromHtmlUrl } from "../utils/issue";
import { HttpStatusCode, Result } from "../types/result-types";
import { startTask } from "./start-task";
import { getDeadline } from "./start/helpers/get-deadline";

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
    context.logger.info("No linked issues were found, nothing to do.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }

  const appOctokit = new customOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: context.env.APP_ID,
      privateKey: context.env.APP_PRIVATE_KEY,
    },
  });

  for (const issue of issues) {
    if (!issue || issue.assignees.nodes?.length) {
      continue;
    }

    const installation = await appOctokit.rest.apps.getRepoInstallation({
      owner: issue.repository.owner.login,
      repo: issue.repository.name,
    });
    const repoOctokit = new customOctokit({
      authStrategy: createAppAuth,
      auth: {
        appId: Number(context.env.APP_ID),
        privateKey: context.env.APP_PRIVATE_KEY,
        installationId: installation.data.id,
      },
    });

    const linkedIssue = (
      await repoOctokit.rest.issues.get({
        owner: issue.repository.owner.login,
        repo: issue.repository.name,
        issue_number: issue.number,
      })
    ).data as Context<"issue_comment.created">["payload"]["issue"];
    const deadline = getDeadline(linkedIssue.labels);
    if (!deadline) {
      context.logger.debug("Skipping deadline posting message because no deadline has been set.");
      return { status: HttpStatusCode.NOT_MODIFIED };
    }

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
    const newContext = {
      ...context,
      octokit: repoOctokit,
      payload: {
        ...context.payload,
        issue: linkedIssue,
        repository,
        organization,
      },
    };
    try {
      return await startTask(newContext, linkedIssue, pull_request.user ?? payload.sender, []);
    } catch (error) {
      await closePullRequest(context, { number: pull_request.number });
      throw error;
    }
  }
  return { status: HttpStatusCode.NOT_MODIFIED };
}
