import { createAppAuth } from "@octokit/auth-app";
import { Repository } from "@octokit/graphql-schema";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Context, isIssueCommentEvent } from "../types";
import { QUERY_CLOSING_ISSUE_REFERENCES } from "../utils/get-closing-issue-references";
import { closePullRequest, closePullRequestForAnIssue, getOwnerRepoFromHtmlUrl } from "../utils/issue";
import { HttpStatusCode, Result } from "./result-types";
import { getDeadline } from "./shared/generate-assignment-comment";
import { start } from "./shared/start";
import { stop } from "./shared/stop";

export async function commandHandler(context: Context): Promise<Result> {
  if (!isIssueCommentEvent(context)) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  if (!context.command) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { issue, sender, repository } = context.payload;

  if (context.command.name === "stop") {
    return await stop(context, issue, sender, repository);
  } else if (context.command.name === "start") {
    const teammates = context.command.parameters.teammates ?? [];
    return await start(context, issue, sender, teammates);
  } else {
    return { status: HttpStatusCode.BAD_REQUEST };
  }
}

export async function userStartStop(context: Context): Promise<Result> {
  if (!isIssueCommentEvent(context)) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { issue, comment, sender, repository } = context.payload;
  const slashCommand = comment.body.trim().split(" ")[0].replace("/", "");
  const teamMates = comment.body
    .split("@")
    .slice(1)
    .map((teamMate) => teamMate.split(" ")[0]);

  if (slashCommand === "stop") {
    return await stop(context, issue, sender, repository);
  } else if (slashCommand === "start") {
    return await start(context, issue, sender, teamMates);
  }

  return { status: HttpStatusCode.NOT_MODIFIED };
}

export async function userPullRequest(context: Context<"pull_request.opened" | "pull_request.edited">): Promise<Result> {
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
      return await start(newContext, linkedIssue, pull_request.user ?? payload.sender, []);
    } catch (error) {
      await closePullRequest(context, { number: pull_request.number });
      throw error;
    }
  }
  return { status: HttpStatusCode.NOT_MODIFIED };
}

export async function userUnassigned(context: Context<"issues.unassigned">): Promise<Result> {
  if (!("issue" in context.payload)) {
    context.logger.debug("Payload does not contain an issue, skipping issues.unassigned event.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { payload } = context;
  const { issue, repository, assignee } = payload;
  // 'assignee' is the user that actually got un-assigned during this event. Since it can theoretically be null,
  // we display an error if none is found in the payload.
  if (!assignee) {
    throw context.logger.fatal("No assignee found in payload, failed to close pull-requests.");
  }
  await closePullRequestForAnIssue(context, issue.number, repository, assignee?.login);
  return { status: HttpStatusCode.OK, content: "Linked pull-requests closed." };
}
