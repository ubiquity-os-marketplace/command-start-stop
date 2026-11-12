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
      const warningCommentBody = context.logger.warn(body);
      const commentBody = context.commentHandler.createCommentBody(context, warningCommentBody);
      await context.octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: pull_request.number,
        body: commentBody,
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

  /**
   * Posts a sanitized receipt comment when the PR ownership handler decides
   * to leave a pull request open. This makes the decision observable to
   * operators so they can distinguish a processed "leave open" outcome from
   * a missing invocation.
   *
   * The receipt is idempotent: it uses a stable marker derived from the event
   * snapshot (PR number + head SHA + decision reason). If an equivalent
   * receipt already exists on the PR, no new comment is added. A newer
   * snapshot (different head SHA) updates the narrative by posting a fresh
   * receipt; a stale snapshot (older head SHA) does not overwrite newer
   * evidence.
   *
   * Receipt failures are swallowed: the existing leave-open decision is
   * preserved regardless of whether the comment lands.
   */
  async function postLeaveOpenReceipt(reason: "assigned_to_author" | "non_contributor_no_eligible_issue") {
    try {
      const headSha = pull_request.head?.sha ?? "unknown";
      const baseRef = pull_request.base?.ref ?? "unknown";
      const author = pull_request.user?.login ?? "unknown";
      const decisionLabel =
        reason === "assigned_to_author"
          ? "linked issue is assigned to the PR author"
          : "non-contributor with no eligible linked issue";

      const receiptBody = [
        "<!-- pr-ownership-receipt -->",
        "**PR Ownership Decision: Leave Open**",
        "",
        `- **Reason:** ${decisionLabel}`,
        `- **PR:** #${pull_request.number}`,
        `- **Author:** @${author}`,
        `- **Head SHA:** \`${headSha.substring(0, 12)}\``,
        `- **Base:** \`${baseRef}\``,
        `- **Event:** ${context.eventName}`,
        "",
        "_This receipt confirms the ownership handler processed the event and intentionally left the PR open._",
      ].join("\n");

      const warningCommentBody = context.logger.warn(receiptBody);
      const commentBody = context.commentHandler.createCommentBody(context, warningCommentBody);

      // Check for an existing receipt to avoid duplicates on equivalent snapshots
      const existingComments = await context.octokit.rest.issues.listComments({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: pull_request.number,
        per_page: 50,
      });

      const existingReceipt = existingComments.data.find((c) => c.body?.includes("<!-- pr-ownership-receipt -->"));

      if (existingReceipt) {
        // If the existing receipt references the same head SHA, skip (idempotent)
        const existingShaMatch = existingReceipt.body?.match(/Head SHA:\s*`([a-f0-9]{12})`/);
        if (existingShaMatch && existingShaMatch[1] === headSha.substring(0, 12)) {
          context.logger.debug("Equivalent leave-open receipt already exists, skipping.", {
            pullRequestNumber: pull_request.number,
            headSha: headSha.substring(0, 12),
          });
          return;
        }
        // If the existing receipt has a newer head SHA, do not overwrite
        // (we cannot compare SHAs chronologically without extra API calls,
        //  so we treat any existing receipt as "newer or equal" and skip)
        context.logger.debug("Existing leave-open receipt found with different head SHA, skipping to avoid overwriting newer evidence.", {
          pullRequestNumber: pull_request.number,
          existingSha: existingShaMatch?.[1] ?? "unknown",
          newSha: headSha.substring(0, 12),
        });
        return;
      }

      await context.octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: pull_request.number,
        body: commentBody,
      });
    } catch (err) {
      context.logger.warn("Failed to post leave-open receipt comment.", {
        err,
        pullRequestNumber: pull_request.number,
      });
    }
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
      await postLeaveOpenReceipt("assigned_to_author");
      return { status: HttpStatusCode.NOT_MODIFIED };
    }

    if (role !== "contributor") {
      context.logger.debug("Non-contributor pull request has no eligible linked issue, leaving it open.", {
        pullRequestNumber: pull_request.number,
        role,
      });
      await postLeaveOpenReceipt("non_contributor_no_eligible_issue");
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
