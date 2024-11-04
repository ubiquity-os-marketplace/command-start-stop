import { Repository } from "@octokit/graphql-schema";
import { Context, isIssueCommentEvent, Label } from "../types";
import { QUERY_CLOSING_ISSUE_REFERENCES } from "../utils/get-closing-issue-references";
import { addCommentToIssue, closePullRequestForAnIssue, getOwnerRepoFromHtmlUrl } from "../utils/issue";
import { HttpStatusCode, Result } from "./result-types";
import { getDeadline } from "./shared/generate-assignment-comment";
import { start } from "./shared/start";
import { stop } from "./shared/stop";

export async function userStartStop(context: Context): Promise<Result> {
  if (!isIssueCommentEvent(context)) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { payload } = context;
  const { issue, comment, sender, repository } = payload;
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

export async function userSelfAssign(context: Context<"issues.assigned">): Promise<Result> {
  const { payload } = context;
  const { issue } = payload;
  const deadline = getDeadline(issue.labels);

  if (!deadline) {
    context.logger.debug("Skipping deadline posting message because no deadline has been set.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }

  const users = issue.assignees.map((user) => `@${user?.login}`).join(", ");

  await addCommentToIssue(context, `${users} the deadline is at ${deadline}`);
  return { status: HttpStatusCode.OK };
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
  for (const issue of issues) {
    if (issue && !issue.assignees.nodes?.length) {
      const labels =
        issue.labels?.nodes?.reduce<Label[]>((acc, curr) => {
          if (curr) {
            acc.push({
              ...curr,
              id: Number(curr.id),
              node_id: curr.id,
              default: true,
              description: curr.description ?? null,
            });
          }
          return acc;
        }, []) ?? [];
      const deadline = getDeadline(labels);
      if (!deadline) {
        context.logger.debug("Skipping deadline posting message because no deadline has been set.");
        return { status: HttpStatusCode.NOT_MODIFIED };
      } else {
        const issueWithComment: Context<"issue_comment.created">["payload"]["issue"] = {
          ...issue,
          assignees: issue.assignees.nodes as Context<"issue_comment.created">["payload"]["issue"]["assignees"],
          labels,
          html_url: issue.url,
        } as unknown as Context<"issue_comment.created">["payload"]["issue"];
        context.payload = Object.assign({ issue: issueWithComment }, context.payload);
        return await start(context, issueWithComment, payload.sender, []);
      }
    }
  }
  return { status: HttpStatusCode.NOT_MODIFIED };
}

export async function userUnassigned(context: Context): Promise<Result> {
  if (!("issue" in context.payload)) {
    context.logger.debug("Payload does not contain an issue, skipping issues.unassigned event.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { payload } = context;
  const { issue, sender, repository } = payload;
  await closePullRequestForAnIssue(context, issue.number, repository, sender.login);
  return { status: HttpStatusCode.OK, content: "Linked pull-requests closed." };
}
