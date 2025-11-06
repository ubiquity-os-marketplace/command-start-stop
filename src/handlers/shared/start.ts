import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import { AssignedIssue, Context, ISSUE_TYPE, Label } from "../../types/index";
import { addAssignees, getAssignedIssues, getPendingOpenedPullRequests, getTimeValue, isParentIssue } from "../../utils/issue";
import { HttpStatusCode, Result } from "../result-types";
import { hasUserBeenUnassigned } from "./check-assignments";
import { checkTaskStale } from "./check-task-stale";
import { generateAssignmentComment, getDeadline } from "./generate-assignment-comment";
import { getTransformedRole, getUserRoleAndTaskLimit } from "./get-user-task-limit-and-role";
import structuredMetadata from "./structured-metadata";
import { assignTableComment } from "./table";

const ERROR_MESSAGES = {
  UNASSIGNED: "{{username}} you were previously unassigned from this task. You cannot be reassigned.",
  MAX_TASK_LIMIT: "You have reached your max task limit. Please close out some tasks before assigning new ones.",
  MAX_TASK_LIMIT_PREFIX: "You have reached your max task limit",
  MAX_TASK_LIMIT_TEAMMATE_PREFIX: "has reached their max task limit",
  ALL_TEAMMATES_REACHED: "All teammates have reached their max task limit. Please close out some tasks before assigning new ones.",
  PARENT_ISSUES: "Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues.",
  CLOSED: "This issue is closed, please choose another.",
  ALREADY_ASSIGNED: "You are already assigned to this task. Please choose another unassigned task.",
  PRICE_LABEL_REQUIRED: "You may not start the task because the issue requires a price label. Please ask a maintainer to add pricing.",
  PRICE_LIMIT_EXCEEDED:
    "While we appreciate your enthusiasm @{{user}}, the price of this task exceeds your allowed limit. Please choose a task with a price of ${{userAllowedMaxPrice}} or less.",
  PRICE_LABEL_FORMAT_ERROR: "Price label is not in the correct format",
  TASK_STALE: "Task appears stale; confirm specification before starting.",
  TASK_ASSIGNED: "Task assigned successfully",
  MISSING_SENDER: "Missing sender",
  NOT_BUSINESS_PRIORITY:
    "This task does not reflect a business priority at the moment.\nYou may start tasks with one of the following labels: {{requiredLabelsToStart}}",
  PRESERVATION_MODE: "External contributors are not eligible for rewards at this time. We are preserving resources for core team only.",
} as const;

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
      const errorText = ERROR_MESSAGES.NOT_BUSINESS_PRIORITY.replace(
        "{{requiredLabelsToStart}}",
        requiredLabelsToStart.map((label) => `\`${label.name}\``).join(", ")
      );

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

async function handleStartErrors(context: Context, eligibility: StartEligibilityResult): Promise<Result> {
  const { logger } = context;
  const errorMessages = eligibility.errors.map((e) => e.logMessage.raw.toLowerCase());

  // Check for unassigned errors first - these should take precedence over all other errors
  const unassignedPattern = ERROR_MESSAGES.UNASSIGNED.toLowerCase().replace("{{username}}", "").trim();
  const unassignedError = eligibility.errors.find((e) => {
    const lowerMsg = e.logMessage.raw.toLowerCase();
    return lowerMsg.includes(unassignedPattern);
  });
  if (unassignedError) {
    throw unassignedError;
  }

  const hasParentReason = errorMessages.some((msg) => msg.includes(ERROR_MESSAGES.PARENT_ISSUES.toLowerCase()));
  const hasPreParentReason = errorMessages.some((msg) => msg.includes(ERROR_MESSAGES.PRICE_LABEL_REQUIRED.toLowerCase()));

  // Preserve original ordering: if pre-parent validations fail, do NOT post parent comment
  if (hasParentReason && !hasPreParentReason) {
    const message = logger.error(ERROR_MESSAGES.PARENT_ISSUES);
    await context.commentHandler.postComment(context, message);
    throw message;
  }

  // Quota-only cases: post comment with assigned issues list
  const quotaPrefixLower = ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX.toLowerCase();
  const quotaTeammatePrefixLower = ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX.toLowerCase();
  const isQuotaOnly = errorMessages.every((msg) => msg.includes(quotaTeammatePrefixLower) || msg.includes(quotaPrefixLower));

  if (isQuotaOnly) {
    const { toAssign, assignedIssues, consideredCount } = eligibility.computed;
    if (toAssign.length === 0 && consideredCount > 1) {
      const allTeammatesPattern = "All teammates have reached";
      const error = eligibility.errors.find((e) => e.logMessage.raw.includes(allTeammatesPattern));
      if (error) throw error;
    } else if (toAssign.length === 0) {
      const error = eligibility.errors.find((e) => e.logMessage.raw.includes(ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX));
      if (error) {
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
          logger.warn(`
${ERROR_MESSAGES.MAX_TASK_LIMIT}

${issues}
`)
        );
        return { content: ERROR_MESSAGES.MAX_TASK_LIMIT, status: HttpStatusCode.NOT_MODIFIED };
      }
    }
  }

  if (eligibility.errors.length > 1) {
    throw new AggregateError(eligibility.errors.map((e) => new Error(e.logMessage.raw)));
  }

  throw eligibility.errors[0];
}

export async function start(
  context: Context,
  issue: Context<"issue_comment.created">["payload"]["issue"],
  sender: Context["payload"]["sender"],
  teammates: string[]
): Promise<Result> {
  const { logger } = context;

  if (!sender) {
    throw logger.error(`Skipping '/start' since there is no sender in the context.`);
  }

  // Centralized eligibility gate without side effects
  const eligibility = await evaluateStartEligibility(context, issue, sender, teammates);

  if (!eligibility.ok) {
    // handleStartErrors will either throw or return an error result
    return await handleStartErrors(context, eligibility);
  }

  // All checks passed, perform assignment
  return performAssignment(context, issue, sender, eligibility.computed.toAssign);
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
  // Check for unassignment first - this should take precedence over task limit
  if (await hasUserBeenUnassigned(context, username)) {
    throw logger.warn(ERROR_MESSAGES.UNASSIGNED.replace("{{username}}", username), { username });
  }

  const openedPullRequests = await getPendingOpenedPullRequests(context, username);
  const assignedIssues = await getAssignedIssues(context, username);
  const { limit, role } = await getUserRoleAndTaskLimit(context, username);

  // check for max and enforce max
  if (Math.abs(assignedIssues.length - openedPullRequests.length) >= limit) {
    const errorMessage = username === sender ? ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX : `${username} ${ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX}`;
    logger.error(errorMessage, {
      assignedIssues: assignedIssues.length,
      openedPullRequests: openedPullRequests.length,
      limit,
    });

    return {
      isWithinLimit: false,
      issues: assignedIssues,
    };
  }

  return {
    isWithinLimit: true,
    issues: [],
    role,
  };
}

export type StartEligibilityResult = {
  ok: boolean;
  errors: LogReturn[];
  warnings: string[];
  computed: {
    deadline: string | null;
    isTaskStale: boolean;
    wallet: string | null;
    toAssign: string[];
    assignedIssues: AssignedIssue[];
    consideredCount: number;
    senderRole: ReturnType<typeof getTransformedRole>;
  };
};

export async function evaluateStartEligibility(
  context: Context,
  issue: Context<"issue_comment.created">["payload"]["issue"],
  sender: Context<"issue_comment.created">["payload"]["sender"],
  teammates: string[]
): Promise<StartEligibilityResult> {
  const errors: LogReturn[] = [];
  const warnings: string[] = [];
  const assignedIssues: AssignedIssue[] = [];

  if (!sender) {
    errors.push(context.logger.error(ERROR_MESSAGES.MISSING_SENDER));
  }

  const labels = (issue.labels ?? []) as Label[];
  const priceLabel = labels.find((label: Label) => label.name.startsWith("Price: "));
  const userAssociation = await getUserRoleAndTaskLimit(context, sender.login);
  const userRole = userAssociation.role;

  // Collaborators need price label
  if (!priceLabel && userRole === "contributor") {
    errors.push(context.logger.error(ERROR_MESSAGES.PRICE_LABEL_REQUIRED));
  }

  const checkReqErr = await checkRequirements(context, issue, userRole);
  if (checkReqErr) {
    errors.push(context.logger.error(checkReqErr.message));
  }

  if (issue.body && isParentIssue(issue.body)) {
    errors.push(context.logger.error(ERROR_MESSAGES.PARENT_ISSUES));
  }

  if (issue.state === ISSUE_TYPE.CLOSED) {
    errors.push(context.logger.error(ERROR_MESSAGES.CLOSED));
  }

  const assignees = issue?.assignees ?? [];
  if (assignees.length) {
    errors.push(context.logger.error(ERROR_MESSAGES.ALREADY_ASSIGNED));
  }

  const allUsers = [...new Set([sender.login, ...teammates])];
  const toAssign: string[] = [];
  for (const user of allUsers) {
    let role: ReturnType<typeof getTransformedRole> | undefined = undefined;
    try {
      const res = await handleTaskLimitChecks({ context, logger: context.logger, sender: sender.login, username: user });
      // within limit?
      if (!res.isWithinLimit) {
        const message = user === sender.login ? ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX : `${user} ${ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX}`;
        errors.push(
          context.logger.error(message, {
            assignedIssues: res.issues.length,
            openedPullRequests: 0,
            limit: 0,
          })
        );
        // capture issues for later comment rendering
        res.issues.forEach((issue) => {
          assignedIssues.push({ title: issue.title, html_url: issue.html_url });
        });
      } else {
        toAssign.push(user);
      }
      // role for price ceiling check
      role = res.role as ReturnType<typeof getTransformedRole> | undefined;
    } catch (e) {
      if (e instanceof Error) {
        errors.push(context.logger.error(e.message));
      } else if (e instanceof LogReturn) {
        errors.push(e);
      } else {
        errors.push(context.logger.error(`An error occurred while checking the task limit for ${user}`, { e }));
      }
    }

    if (priceLabel && role && role !== "admin") {
      const { usdPriceMax } = context.config.taskAccessControl;
      const min = Math.min(...Object.values(usdPriceMax));
      const allowed = role in usdPriceMax ? usdPriceMax[role as keyof typeof usdPriceMax] : undefined;
      const userAllowedMaxPrice = typeof allowed === "number" ? allowed : min;
      const match = priceLabel.name.match(/Price:\s*([\d.]+)/);
      if (!match || isNaN(parseFloat(match[1]))) {
        errors.push(context.logger.error(ERROR_MESSAGES.PRICE_LABEL_FORMAT_ERROR, { priceLabel: priceLabel.name }));
      } else {
        const price = parseFloat(match[1]);
        if (userAllowedMaxPrice < 0) {
          errors.push(context.logger.warn(ERROR_MESSAGES.PRESERVATION_MODE, { userRole: role, price, userAllowedMaxPrice, issueNumber: issue.number }));
        } else if (price > userAllowedMaxPrice) {
          errors.push(
            context.logger.warn(
              ERROR_MESSAGES.PRICE_LIMIT_EXCEEDED.replace("{{user}}", user).replace("{{userAllowedMaxPrice}}", userAllowedMaxPrice.toString()),
              { userRole: role, price, userAllowedMaxPrice, issueNumber: issue.number }
            )
          );
        }
      }
    }
  }

  // Only add summary error if we haven't already added individual user errors
  // (individual errors are added in the loop above when users exceed their limit)
  if (toAssign.length === 0 && allUsers.length > 0) {
    const message = allUsers.length > 1 ? ERROR_MESSAGES.ALL_TEAMMATES_REACHED : ERROR_MESSAGES.MAX_TASK_LIMIT;
    // Only add if we don't already have quota-related errors (to avoid duplicates)
    const hasQuotaError = errors.some((e) => {
      const lowerMsg = e.logMessage.raw.toLowerCase();
      return (
        lowerMsg.includes(ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX.toLowerCase()) || lowerMsg.includes(ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX.toLowerCase())
      );
    });
    if (!hasQuotaError) {
      errors.push(context.logger.error(message));
    }
  }

  // Wallet
  let wallet: string | null = null;
  try {
    wallet = await context.adapters.supabase.user.getWalletByUserId(sender.id, issue.number);
  } catch {
    errors.push(context.logger.error(context.config.emptyWalletText));
  }

  // Staleness & deadline
  const isTaskStale = checkTaskStale(getTimeValue(context.config.taskStaleTimeoutDuration), issue.created_at);
  if (isTaskStale) {
    warnings.push(ERROR_MESSAGES.TASK_STALE);
  }
  let deadline: string | null = null;
  try {
    deadline = getDeadline(labels);
  } catch {
    // don't throw (post a comment) "No labels are set." error
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    computed: {
      deadline,
      isTaskStale,
      wallet,
      toAssign,
      assignedIssues,
      consideredCount: allUsers.length,
      senderRole: userRole,
    },
  };
}

export async function performAssignment(
  context: Context,
  issue: Context<"issue_comment.created">["payload"]["issue"],
  sender: { login: string; id: number },
  toAssign: string[]
): Promise<Result> {
  const { logger } = context;
  // compute metadata
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
  const labels = issue.labels ?? [];
  const priceLabel = labels.find((label: Label) => label.name.startsWith("Price: "));
  const isTaskStale = checkTaskStale(getTimeValue(context.config.taskStaleTimeoutDuration), issue.created_at);
  const toAssignIds = await fetchUserIds(context, toAssign);
  const assignmentComment = await generateAssignmentComment(context, issue.created_at, issue.number, sender.id, null);
  const logMessage = logger.info(ERROR_MESSAGES.TASK_ASSIGNED, {
    taskDeadline: assignmentComment.deadline,
    taskAssignees: toAssignIds,
    priceLabel,
    revision: commitHash?.substring(0, 7),
  });
  const metadata = structuredMetadata.create("Assignment", logMessage);

  await addAssignees(context, issue.number, toAssign);

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

  return { content: ERROR_MESSAGES.TASK_ASSIGNED, status: HttpStatusCode.OK };
}
