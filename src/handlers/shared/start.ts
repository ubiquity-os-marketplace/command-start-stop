import { Context, ISSUE_TYPE, Label } from "../../types";
import { isParentIssue, getAvailableOpenedPullRequests, getAssignedIssues, addAssignees, addCommentToIssue, getTimeValue } from "../../utils/issue";
import { calculateDurations } from "../../utils/shared";
import { checkTaskStale } from "./check-task-stale";
import { generateAssignmentComment } from "./generate-assignment-comment";
import structuredMetadata from "./structured-metadata";
import { assignTableComment } from "./table";

export async function start(context: Context, issue: Context["payload"]["issue"], sender: Context["payload"]["sender"], teammates: string[]) {
  const { logger, config } = context;
  const { maxConcurrentTasks, taskStaleTimeoutDuration } = config;

  // is it a child issue?
  if (issue.body && isParentIssue(issue.body)) {
    await addCommentToIssue(
      context,
      "```diff\n# Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues.\n```"
    );
    logger.error(`Skipping '/start' since the issue is a parent issue`);
    return { output: "Parent issue detected" };
  }

  let commitHash: string | null = null;

  try {
    const hashResponse = await context.octokit.rest.repos.getCommit({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      ref: context.payload.repository.default_branch,
    });
    commitHash = hashResponse.data.sha;
  } catch (e) {
    logger.error("Error while getting commit hash", { error: e as Error });
  }

  // is it assignable?

  if (issue.state === ISSUE_TYPE.CLOSED) {
    throw logger.error("This issue is closed, please choose another.", { issueNumber: issue.number });
  }

  const assignees = issue?.assignees ?? [];

  // find out if the issue is already assigned
  if (assignees.length !== 0) {
    const isCurrentUserAssigned = !!assignees.find((assignee) => assignee?.login === sender.login);
    throw logger.error(
      isCurrentUserAssigned ? "You are already assigned to this task." : "This issue is already assigned. Please choose another unassigned task.",
      { issueNumber: issue.number }
    );
  }

  teammates.push(sender.login);

  // check max assigned issues
  for (const user of teammates) {
    await handleTaskLimitChecks(user, context, maxConcurrentTasks, logger, sender.login);
  }

  // get labels
  const labels = issue.labels;
  const priceLabel = labels.find((label: Label) => label.name.startsWith("Price: "));

  if (!priceLabel) {
    throw logger.error("No price label is set to calculate the duration", { issueNumber: issue.number });
  }

  const duration: number = calculateDurations(labels).shift() ?? 0;

  const { id } = sender;
  const logMessage = logger.info("Task assigned successfully", {
    duration,
    priceLabel,
    revision: commitHash?.substring(0, 7),
    assignees: teammates,
    issue: issue.number,
  });

  const assignmentComment = await generateAssignmentComment(context, issue.created_at, issue.number, id, duration);
  const metadata = structuredMetadata.create("Assignment", logMessage);

  // assign the issue
  await addAssignees(context, issue.number, teammates);

  const isTaskStale = checkTaskStale(getTimeValue(taskStaleTimeoutDuration), issue.created_at);

  await addCommentToIssue(
    context,
    [
      assignTableComment({
        isTaskStale,
        daysElapsedSinceTaskCreation: assignmentComment.daysElapsedSinceTaskCreation,
        taskDeadline: assignmentComment.deadline,
        registeredWallet: assignmentComment.registeredWallet,
      }),
      assignmentComment.tips,
      metadata,
    ].join("\n") as string
  );

  return { output: "Task assigned successfully" };
}

async function handleTaskLimitChecks(username: string, context: Context, maxConcurrentTasks: number, logger: Context["logger"], sender: string) {
  const openedPullRequests = await getAvailableOpenedPullRequests(context, username);
  const assignedIssues = await getAssignedIssues(context, username);

  // check for max and enforce max
  if (assignedIssues.length - openedPullRequests.length >= maxConcurrentTasks) {
    throw logger.error(username === sender ? "You have reached your max task limit" : `${username} has reached their max task limit`, {
      assignedIssues: assignedIssues.length,
      openedPullRequests: openedPullRequests.length,
      maxConcurrentTasks,
    });
  }
}
