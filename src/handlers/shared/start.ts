import { Context, ISSUE_TYPE, Label } from "../../types";
import { isParentIssue, getAvailableOpenedPullRequests, getAssignedIssues, addAssignees, addCommentToIssue } from "../../utils/issue";
import { calculateDurations } from "../../utils/shared";
import { checkTaskStale } from "./check-task-stale";
import { wasPreviouslyUnassigned } from "./check-unassigns";
import { generateAssignmentComment } from "./generate-assignment-comment";
import structuredMetadata from "./structured-metadata";
import { assignTableComment } from "./table";

export async function start(context: Context, issue: Context["payload"]["issue"], sender: Context["payload"]["sender"]) {
  const { logger, config } = context;
  const { maxConcurrentTasks } = config.miscellaneous;
  const { taskStaleTimeoutDuration } = config.timers;

  // is it a child issue?
  if (issue.body && isParentIssue(issue.body)) {
    await addCommentToIssue(
      context,
      "```diff\n# Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues.\n```"
    );
    logger.error(`Skipping '/start' since the issue is a parent issue`);
    throw new Error("Issue is a parent issue");
  }

  let commitHash: string | null = null;

  try {
    const hashResponse = await context.octokit.repos.getCommit({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      ref: context.payload.repository.default_branch,
    });
    commitHash = hashResponse.data.sha;
  } catch (e) {
    logger.error("Error while getting commit hash", { error: e as Error });
  }

  // check max assigned issues

  const openedPullRequests = await getAvailableOpenedPullRequests(context, sender.login);
  logger.info(`Opened Pull Requests with approved reviews or with no reviews but over 24 hours have passed: ${JSON.stringify(openedPullRequests)}`);

  const assignedIssues = await getAssignedIssues(context, sender.login);
  logger.info("Max issue allowed is", { maxConcurrentTasks });

  // check for max and enforce max

  if (assignedIssues.length - openedPullRequests.length >= maxConcurrentTasks) {
    await addCommentToIssue(context, "```diff\n! Too many assigned issues, you have reached your max limit.\n```");
    throw new Error(`Too many assigned issues, you have reached your max limit of ${maxConcurrentTasks} issues.`);
  }

  // is it assignable?

  if (issue.state === ISSUE_TYPE.CLOSED) {
    await addCommentToIssue(context, "```diff\n! The issue is closed. Please choose another unassigned task.\n```");
    throw new Error("Issue is closed");
  }

  const assignees = (issue?.assignees ?? []).filter(Boolean);
  if (assignees.length !== 0) {
    await addCommentToIssue(context, "```diff\n! The issue is already assigned. Please choose another unassigned task.\n```");
    throw new Error("Issue is already assigned");
  }

  // get labels

  const labels = issue.labels;
  const priceLabel = labels.find((label: Label) => label.name.startsWith("Price: "));
  const isUnassigned = await wasPreviouslyUnassigned(context, sender, issue);

  if (!priceLabel) {
    await addCommentToIssue(context, "```diff\n! No price label is set to calculate the duration.\n```");
    throw new Error("No price label is set to calculate the duration");
  }

  if (isUnassigned) {
    await addCommentToIssue(context, "```diff\n! You were previously unassigned from this task. You cannot reassign yourself\n```");
    throw new Error(`This user was unassigned from this task previously. Cannot auto assign`);
  }

  const duration: number = calculateDurations(labels).shift() ?? 0;

  const { id, login } = sender;
  const logMessage = logger.info("Task assigned successfully", { duration, priceLabel, revision: commitHash?.substring(0, 7) });

  const assignmentComment = await generateAssignmentComment(context, issue.created_at, issue.number, id, duration);
  const metadata = structuredMetadata.create("Assignment", logMessage);

  // add assignee
  if (!assignees.map((i) => i?.login).includes(login)) {
    await addAssignees(context, issue.number, [login]);
  }

  const isTaskStale = checkTaskStale(taskStaleTimeoutDuration, issue.created_at);

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
