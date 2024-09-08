import { Assignee, Context, Sender } from "../../types";
import { addCommentToIssue, closePullRequestForAnIssue } from "../../utils/issue";
import { HttpStatusCode, Result } from "../result-types";

export async function stop(context: Context, issue: Context["payload"]["issue"], sender: Sender, repo: Context["payload"]["repository"]): Promise<Result> {
  const { logger } = context;
  const issueNumber = issue.number;

  // is there an assignee?
  const assignees = issue.assignees ?? [];
  // should unassign?
  const userToUnassign = assignees.find((assignee: Partial<Assignee>) => assignee?.login?.toLowerCase() === sender.login.toLowerCase());

  if (!userToUnassign) {
    throw new Error(logger.error("You are not assigned to this task", { issueNumber, user: sender.login })?.logMessage.raw as string);
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
    throw new Error(
      logger.error(`Error while removing ${userToUnassign.login} from the issue: `, {
        err,
        issueNumber,
        user: userToUnassign.login,
      }).logMessage.raw
    );
  }

  const unassignedLog = logger.info("You have been unassigned from the task", {
    issueNumber,
    user: userToUnassign.login,
  });

  await addCommentToIssue(context, unassignedLog?.logMessage.diff as string);
  return { content: "Task unassigned successfully", status: HttpStatusCode.OK };
}
