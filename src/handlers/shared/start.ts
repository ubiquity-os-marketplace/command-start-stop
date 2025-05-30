import { AssignedIssue, Context, ISSUE_TYPE, Label } from "../../types/index";
import { addAssignees, getAssignedIssues, getPendingOpenedPullRequests, getTimeValue, isParentIssue } from "../../utils/issue";
import { HttpStatusCode, Result } from "../result-types";
import { hasUserBeenUnassigned } from "./check-assignments";
import { checkTaskStale } from "./check-task-stale";
import { generateAssignmentComment } from "./generate-assignment-comment";
import { getTransformedRole, getUserRoleAndTaskLimit } from "./get-user-task-limit-and-role";
import structuredMetadata from "./structured-metadata";
import { assignTableComment } from "./table";

export async function checkRequirements(
  context: Context,
  issue: Context<"issue_comment.created">["payload"]["issue"],
  userRole: ReturnType<typeof getTransformedRole>
): Promise<Error | null> {
  const {
    config: { requiredLabelsToStart },
    logger,
  } = context;
  const issueLabels = issue.labels.map((label) => label.name.toLowerCase());

  if (requiredLabelsToStart.length) {
    const currentLabelConfiguration = requiredLabelsToStart.find((label) =>
      issueLabels.some((issueLabel) => label.name.toLowerCase() === issueLabel.toLowerCase())
    );

    // Admins can start any task
    if (userRole === "admin") {
      return null;
    }

    if (!currentLabelConfiguration) {
      // If we didn't find the label in the allowed list, then the user cannot start this task.
      const errorText = `This task does not reflect a business priority at the moment.\nYou may start tasks with one of the following labels: ${requiredLabelsToStart.map((label) => "`" + label.name + "`").join(", ")}`;
      logger.error(errorText, {
        requiredLabelsToStart,
        issueLabels,
        issue: issue.html_url,
      });
      return new Error(errorText);
    } else if (!currentLabelConfiguration.allowedRoles.includes(userRole)) {
      // If we found the label in the allowed list, but the user role does not match the allowed roles, then the user cannot start this task.
      const humanReadableRoles = [
        ...currentLabelConfiguration.allowedRoles.map((o) => (o === "collaborator" ? "a core team member" : `a ${o}`)),
        "an administrator",
      ].join(", or ");
      const errorText = `You must be ${humanReadableRoles} to start this task`;
      logger.error(errorText, {
        currentLabelConfiguration,
        issueLabels,
        issue: issue.html_url,
        userRole,
      });
      return new Error(errorText);
    }
  }
  return null;
}

export async function start(
  context: Context,
  issue: Context<"issue_comment.created">["payload"]["issue"],
  sender: Context["payload"]["sender"],
  teammates: string[]
): Promise<Result> {
  const { logger, config } = context;
  const { taskStaleTimeoutDuration, taskAccessControl } = config;

  if (!sender) {
    throw logger.error(`Skipping '/start' since there is no sender in the context.`);
  }

  const labels = issue.labels ?? [];
  const priceLabel = labels.find((label: Label) => label.name.startsWith("Price: "));
  const userAssociation = await getUserRoleAndTaskLimit(context, sender.login);
  const userRole = getTransformedRole(userAssociation.role);

  const startErrors: Error[] = [];

  // Collaborators and admins can start un-priced tasks
  if (!priceLabel && userRole === "contributor") {
    const errorMessage = "No price label is set to calculate the duration";
    logger.error(errorMessage, { issueNumber: issue.number });
    startErrors.push(new Error(errorMessage));
  }

  const checkRequirementsError = await checkRequirements(context, issue, userRole);
  if (checkRequirementsError) {
    startErrors.push(checkRequirementsError);
  }

  if (startErrors.length) {
    throw new AggregateError(startErrors);
  }

  // is it a child issue?
  if (issue.body && isParentIssue(issue.body)) {
    const message = logger.error("Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues.");
    await context.commentHandler.postComment(context, message);
    throw message;
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

  const toAssign = [];
  let assignedIssues: AssignedIssue[] = [];
  // check max assigned issues
  for (const user of teammates) {
    const { isWithinLimit, issues, role } = await handleTaskLimitChecks({ context, logger, sender: sender.login, username: user });
    if (isWithinLimit) {
      toAssign.push(user);
    } else {
      issues.forEach((issue) => {
        assignedIssues = assignedIssues.concat({
          title: issue.title,
          html_url: issue.html_url,
        });
      });
    }

    if (priceLabel && role !== "admin") {
      const { usdPriceMax } = taskAccessControl;
      const min = Math.min(...Object.values(usdPriceMax));
      const userAllowedMaxPrice = !role ? min : usdPriceMax[role as keyof typeof usdPriceMax];

      const priceRegex = /Price:\s*([\d.]+)/;
      const match = priceLabel.name.match(priceRegex);
      if (!match) {
        throw logger.error("Price label is not in the correct format", { priceLabel: priceLabel.name });
      }
      const value = match[1];
      if (isNaN(parseFloat(value))) {
        throw logger.error("Price label is not in the correct format", { priceLabel: priceLabel.name });
      }
      const price = parseFloat(value);
      if (userAllowedMaxPrice < 0) {
        throw logger.warn(`External contributors are not eligible for rewards at this time. We are preserving resources for core team only.`, {
          userRole,
          price,
          userAllowedMaxPrice,
          issueNumber: issue.number,
        });
      } else if (price > userAllowedMaxPrice) {
        throw logger.warn(
          `While we appreciate your enthusiasm @${user}, the price of this task exceeds your allowed limit. Please choose a task with a price of $${userAllowedMaxPrice} or less.`,
          {
            userRole,
            price,
            userAllowedMaxPrice,
            issueNumber: issue.number,
          }
        );
      }
    }
  }

  let error: string | null = null;
  if (toAssign.length === 0 && teammates.length > 1) {
    error = "All teammates have reached their max task limit. Please close out some tasks before assigning new ones.";
    throw logger.error(error, { issueNumber: issue.number });
  } else if (toAssign.length === 0) {
    error = "You have reached your max task limit. Please close out some tasks before assigning new ones.";
    let issues = "";
    const urlPattern = /https:\/\/(github.com\/(\S+)\/(\S+)\/issues\/(\d+))/;
    assignedIssues.forEach((el) => {
      const match = el.html_url.match(urlPattern);
      if (match) {
        issues = issues.concat(`- ###### [${match[2]}/${match[3]} - ${el.title} #${match[4]}](https://www.${match[1]})\n`);
      } else {
        issues = issues.concat(`- ###### [${el.title}](${el.html_url})\n`);
      }
    });

    await context.commentHandler.postComment(
      context,
      context.logger.warn(`
${error}

${issues}
`)
    );
    return { content: error, status: HttpStatusCode.NOT_MODIFIED };
  }

  const toAssignIds = await fetchUserIds(context, toAssign);
  const assignmentComment = await generateAssignmentComment(context, issue.created_at, issue.number, sender.id, null);
  const logMessage = logger.info("Task assigned successfully", {
    taskDeadline: assignmentComment.deadline,
    taskAssignees: toAssignIds,
    priceLabel,
    revision: commitHash?.substring(0, 7),
  });
  const metadata = structuredMetadata.create("Assignment", logMessage);

  // add assignee
  await addAssignees(context, issue.number, toAssign);

  const isTaskStale = checkTaskStale(getTimeValue(taskStaleTimeoutDuration), issue.created_at);

  await context.commentHandler.postComment(
    context,
    logger.ok(
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
    ),
    { raw: true }
  );

  return { content: "Task assigned successfully", status: HttpStatusCode.OK };
}

async function fetchUserIds(context: Context, username: string[]) {
  const ids = [];

  for (const user of username) {
    const { data } = await context.octokit.rest.users.getByUsername({
      username: user,
    });

    ids.push(data.id);
  }

  if (ids.filter((id) => !id).length > 0) {
    throw new Error("Error while fetching user ids");
  }

  return ids;
}

async function handleTaskLimitChecks({ context, logger, sender, username }: { username: string; context: Context; logger: Context["logger"]; sender: string }) {
  const openedPullRequests = await getPendingOpenedPullRequests(context, username);
  const assignedIssues = await getAssignedIssues(context, username);
  const { limit, role } = await getUserRoleAndTaskLimit(context, username);

  // check for max and enforce max
  if (Math.abs(assignedIssues.length - openedPullRequests.length) >= limit) {
    logger.error(username === sender ? "You have reached your max task limit" : `${username} has reached their max task limit`, {
      assignedIssues: assignedIssues.length,
      openedPullRequests: openedPullRequests.length,
      limit,
    });

    return {
      isWithinLimit: false,
      issues: assignedIssues,
    };
  }

  if (await hasUserBeenUnassigned(context, username)) {
    throw logger.warn(`${username} you were previously unassigned from this task. You cannot be reassigned.`, { username });
  }

  return {
    isWithinLimit: true,
    issues: [],
    role,
  };
}
