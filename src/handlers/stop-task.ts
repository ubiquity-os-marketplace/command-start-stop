import { Assignee, Context, Sender } from "../types/index";
import { HttpStatusCode, Result } from "../types/result-types";
import { closePullRequestForAnIssue } from "../utils/issue";

export async function stop(
  context: Context,
  issue: Context<"issue_comment.created">["payload"]["issue"],
  sender: Sender,
  repo: Context["payload"]["repository"]
): Promise<Result> {
  const { logger } = context;
  const issueNumber = issue.number;

  // is there an assignee?
  const assignees = issue.assignees ?? [];
  // should unassign?
  const userToUnassign = assignees.find((assignee: Partial<Assignee>) => assignee?.login?.toLowerCase() === sender.login.toLowerCase());

  if (!userToUnassign) {
    throw logger.error("You are not assigned to this task", { issueNumber, user: sender.login });
  }

  // close PR
  await closePullRequestForAnIssue(context, issueNumber, repo, userToUnassign.login);

  const {
    name,
    owner: { login },
  } = repo;

  // remove assignee

  try {
    await context.octokit.rest.issues.removeAssignees({
      owner: login,
      repo: name,
      issue_number: issueNumber,
      assignees: [userToUnassign.login],
    });
  } catch (err) {
    throw logger.error(`Error while removing ${userToUnassign.login} from the issue: `, {
      err,
      issueNumber,
      user: userToUnassign.login,
    });
  }

  return { content: "Task unassigned successfully", status: HttpStatusCode.OK };
}
