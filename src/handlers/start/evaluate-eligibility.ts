import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import { AssignedIssue, Context, ISSUE_TYPE, Label } from "../../types/index";
import { getTimeValue, isParentIssue } from "../../utils/issue";
import { getTransformedRole, getUserRoleAndTaskLimit } from "../../utils/get-user-task-limit-and-role";
import { checkRequirements } from "./helpers/check-requirements";
import { ERROR_MESSAGES } from "./helpers/error-messages";
import { handleTaskLimitChecks } from "./helpers/check-assignments";
import { checkTaskStale } from "./helpers/check-task-stale";
import { getDeadline } from "./helpers/get-deadline";

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
    // Check if the sender is already assigned to this issue
    const isSenderAssigned = assignees.some((assignee) => assignee?.login?.toLowerCase() === sender.login.toLowerCase());
    const errorMessage = isSenderAssigned ? ERROR_MESSAGES.ALREADY_ASSIGNED : ERROR_MESSAGES.ISSUE_ALREADY_ASSIGNED;
    errors.push(context.logger.error(errorMessage));
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
