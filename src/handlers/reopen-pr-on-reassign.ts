import { Context } from "../types/context";
import { HttpStatusCode, Result } from "../types/result-types";
import { getOpenLinkedPullRequestsForIssue } from "../utils/issue";
import { createRepoOctokit } from "./start/api/helpers/octokit";

/**
 * When a user is assigned to an issue, check if there's a previously-closed PR
 * from a different contributor linked to the same issue. If so, reopen it.
 *
 * This handles the workflow where:
 * 1. Contributor submits a PR → PR gets closed (e.g. deadline, unassigned)
 * 2. Admin re-assigns the issue to a new contributor
 * 3. Bot automatically re-opens the old contributor's PR
 */
export async function reopenPrOnReassign(context: Context<"issues.assigned">): Promise<Result> {
  if (!("issue" in context.payload)) {
    context.logger.debug("Payload does not contain an issue, skipping issues.assigned event.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }

  const { payload } = context;
  const { issue, repository, assignee } = payload;

  if (!assignee) {
    context.logger.debug("No assignee found in payload, skipping.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }

  const newAssigneeLogin = assignee.login;
  context.logger.info(`User ${newAssigneeLogin} assigned to issue #${issue.number}`);

  // Get linked pull requests for this issue
  const linkedPullRequests = await getOpenLinkedPullRequestsForIssue(context, {
    owner: repository.owner.login,
    repository: repository.name,
    issue: issue.number,
  });

  // No linked PRs to check
  if (!linkedPullRequests.length) {
    context.logger.debug(`No linked pull requests found for issue #${issue.number}`);
    return { status: HttpStatusCode.OK };
  }

  // Find closed PRs from a different author that should be re-opened
  const toReopen: Array<{ number: number; author: string; href: string }> = [];
  for (const pr of linkedPullRequests) {
    // Only consider closed PRs that aren't from the new assignee
    if (pr.state !== "closed" || pr.author.toLowerCase() === newAssigneeLogin.toLowerCase()) {
      continue;
    }
    // Check if the PR author matches the previous assignee (we need to find the previous assignee)
    // Since we can't easily get the previous assignee from just the assigned event,
    // we reopen any closed PR from a different author whose linked issue is being re-assigned.
    // The maintainer can always close it again if needed.
    toReopen.push(pr);
  }

  if (!toReopen.length) {
    context.logger.debug(`No closed PRs from other contributors to reopen for issue #${issue.number}`);
    return { status: HttpStatusCode.OK };
  }

  context.logger.info(`Found ${toReopen.length} closed PR(s) to reopen for issue #${issue.number}`);

  for (const pr of toReopen) {
    try {
      const repoOctokit = await createRepoOctokit(context.env, repository.owner.login, repository.name);
      await repoOctokit.rest.pulls.update({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: pr.number,
        state: "open",
      });

      // Comment on the PR to explain why it was reopened
      const commentBody = context.commentHandler.createCommentBody(
        context,
        `This pull request was automatically re-opened because issue #${issue.number} has been assigned to @${newAssigneeLogin}. Your previous work on this issue is welcome again!`
      );
      await repoOctokit.rest.issues.createComment({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: pr.number,
        body: commentBody,
      });

      context.logger.ok(`Reopened PR #${pr.number} for re-assigned issue #${issue.number}`);
    } catch (err) {
      context.logger.warn(`Failed to reopen PR #${pr.number}`, { error: err as Error });
    }
  }

  return { status: HttpStatusCode.OK, content: `Reopened ${toReopen.length} pull request(s).` };
}