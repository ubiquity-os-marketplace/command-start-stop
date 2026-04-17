import { Repository } from "@octokit/graphql-schema";
import { Context } from "../types/context";
import { HttpStatusCode, Result } from "../types/result-types";
import { QUERY_CLOSING_ISSUE_REFERENCES } from "../utils/get-closing-issue-references";
import { getUserRoleAndTaskLimit } from "../utils/get-user-task-limit-and-role";
import { closePullRequest, getOwnerRepoFromHtmlUrl } from "../utils/issue";
import { createRepoOctokit } from "./start/api/helpers/octokit";
import { ERROR_MESSAGES } from "./start/helpers/error-messages";
import { startTask } from "./start-task";

type LinkedIssues = NonNullable<NonNullable<NonNullable<Repository["pullRequest"]>["closingIssuesReferences"]>["nodes"]>;
type LinkedIssue = NonNullable<LinkedIssues[number]>;

function formatMessage(template: string, username: string) {
  return template.replace("{{user}}", username);
}

function isClosedIssue(issue: LinkedIssue) {
  return String(issue.state).toUpperCase() === "CLOSED";
}

function getAssigneeLogins(issue: LinkedIssue) {
  return issue.assignees.nodes?.flatMap((assignee) => (assignee?.login ? [assignee.login.toLowerCase()] : [])) ?? [];
}

export async function newPullRequestOrEdit(context: Context<"pull_request.opened" | "pull_request.edited">): Promise<Result> {
  const { payload } = context;
  const { pull_request } = payload;

  if (!pull_request.user) {
    context.logger.debug("Pull request has no user associated, skipping.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }

  async function commentOnTriggeredPullRequest(body: string) {
    try {
      const warningCommentBody = context.logger.warn(body).logMessage.diff;
      await context.octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: pull_request.number,
        body: warningCommentBody,
      });
    } catch (err) {
      context.logger.warn("Failed to comment on triggering pull request.", {
        err,
        pullRequestNumber: pull_request.number,
      });
    }
  }

  async function closeTriggeredPullRequest() {
    try {
      await closePullRequest(context, { number: pull_request.number });
    } catch (err) {
      context.logger.warn("Failed to close triggering pull request.", {
        err,
        pullRequestNumber: pull_request.number,
      });
    }
  }

  async function commentAndCloseTriggeredPullRequest(body: string) {
    await commentOnTriggeredPullRequest(body);
    await closeTriggeredPullRequest();
    return {
      status: HttpStatusCode.BAD_REQUEST,
      content: body,
    };
  }

  const sourceRepoOctokit = await createRepoOctokit(context.env, payload.repository.owner.login, payload.repository.name);
  const { role } = await getUserRoleAndTaskLimit(
    {
      ...context,
      installOctokit: sourceRepoOctokit,
    },
    pull_request.user.login
  );

  const { owner, repo } = getOwnerRepoFromHtmlUrl(pull_request.html_url);
  const linkedIssues = await context.octokit.graphql.paginate<{ repository: Repository }>(QUERY_CLOSING_ISSUE_REFERENCES, {
    owner,
    repo,
    issue_number: pull_request.number,
  });
  const issues = (linkedIssues.repository.pullRequest?.closingIssuesReferences?.nodes ?? []).filter((issue): issue is LinkedIssue => !!issue);

  const openIssues = issues.filter((issue) => !isClosedIssue(issue));
  const openUnassignedIssues = openIssues.filter((issue) => getAssigneeLogins(issue).length === 0);
  const openIssuesAssignedToAuthor = openIssues.filter((issue) => getAssigneeLogins(issue).includes(pull_request.user.login.toLowerCase()));
  const openIssuesAssignedToOtherUsers = openIssues.filter((issue) => {
    const assignees = getAssigneeLogins(issue);
    return assignees.length > 0 && !assignees.includes(pull_request.user.login.toLowerCase());
  });

  const eligibleIssue = openUnassignedIssues[0];
  if (!eligibleIssue) {
    if (openIssuesAssignedToAuthor.length > 0) {
      context.logger.debug("Pull request is linked to an open issue already assigned to the author, leaving it open.", {
        pullRequestNumber: pull_request.number,
      });
      return { status: HttpStatusCode.NOT_MODIFIED };
    }

    if (role !== "contributor") {
      context.logger.debug("Non-contributor pull request has no eligible linked issue, leaving it open.", {
        pullRequestNumber: pull_request.number,
        role,
      });
      return { status: HttpStatusCode.NOT_MODIFIED };
    }

    if (openIssuesAssignedToOtherUsers.length > 0) {
      return commentAndCloseTriggeredPullRequest(formatMessage(ERROR_MESSAGES.PULL_REQUEST_LINKED_TO_OTHER_ASSIGNEE, pull_request.user.login));
    }

    return commentAndCloseTriggeredPullRequest(formatMessage(ERROR_MESSAGES.INVALID_PULL_REQUEST_LINK, pull_request.user.login));
  }

  const repoOctokit = await createRepoOctokit(context.env, eligibleIssue.repository.owner.login, eligibleIssue.repository.name);

  const linkedIssue = (
    await repoOctokit.rest.issues.get({
      owner: eligibleIssue.repository.owner.login,
      repo: eligibleIssue.repository.name,
      issue_number: eligibleIssue.number,
    })
  ).data as Context<"issue_comment.created">["payload"]["issue"];

  const repository = (
    await repoOctokit.rest.repos.get({
      owner: eligibleIssue.repository.owner.login,
      repo: eligibleIssue.repository.name,
    })
  ).data as Context<"issue_comment.created">["payload"]["repository"];
  let organization: Context<"issue_comment.created">["payload"]["organization"] | undefined = undefined;
  if (repository.owner.type === "Organization") {
    organization = (
      await repoOctokit.rest.orgs.get({
        org: eligibleIssue.repository.owner.login,
      })
    ).data;
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
    const result = await startTask(newContext);
    if (result.status !== HttpStatusCode.OK) {
      await closeTriggeredPullRequest();
    }
    return result;
  } catch (error) {
    await closeTriggeredPullRequest();
    throw error;
  }
}
