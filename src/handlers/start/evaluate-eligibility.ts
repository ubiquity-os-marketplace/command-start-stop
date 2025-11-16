import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";

import { AssignedIssue, Context, ISSUE_TYPE, Label } from "../../types/index";
import { getTransformedRole, getUserRoleAndTaskLimit } from "../../utils/get-user-task-limit-and-role";
import { getTimeValue, isParentIssue } from "../../utils/issue";

import { checkAccountAge, UserProfile } from "./helpers/check-account-age";
import { handleTaskLimitChecks } from "./helpers/check-assignments";
import { checkExperience } from "./helpers/check-experience";
import { checkRequirements } from "./helpers/check-requirements";
import { checkTaskStale } from "./helpers/check-task-stale";
import { ERROR_MESSAGES } from "./helpers/error-messages";
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

export async function evaluateStartEligibility(context: Context<"issue_comment.created">): Promise<StartEligibilityResult> {
  const errors: LogReturn[] = [];
  const warnings: string[] = [];
  const assignedIssues: AssignedIssue[] = [];
  const {
    payload: { issue, sender },
  } = context;

  if ((typeof sender === "object" && !sender.login) || !sender) {
    errors.push(context.logger.error(ERROR_MESSAGES.MISSING_SENDER));
    return {
      ok: false,
      errors,
      warnings,
      computed: {
        deadline: null,
        isTaskStale: false,
        wallet: null,
        toAssign: [],
        assignedIssues: [],
        consideredCount: 0,
        senderRole: "contributor",
      },
    };
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

  const params =
    context.command && "parameters" in context.command
      ? context.command.parameters
      : {
          teammates: [],
        };

  const allUsers = [...new Set([sender.login, ...(params.teammates ?? []).map((u: string) => u.trim()).filter((u: string) => u.length > 0)])];

  // Build participant role mappings for access control checks
  const participantRoleAndLimits: Map<string, { role: ReturnType<typeof getTransformedRole> }> = new Map();
  participantRoleAndLimits.set(sender.login.toLowerCase(), { role: userRole });

  const roleFetches = allUsers
    .filter((username) => !participantRoleAndLimits.has(username.toLowerCase()))
    .map(async (username) => {
      const association = await getUserRoleAndTaskLimit(context, username);
      participantRoleAndLimits.set(username.toLowerCase(), { role: association.role });
    });

  if (roleFetches.length) {
    await Promise.all(roleFetches);
  }

  // User profiles cache for account age checks
  const userProfiles = new Map<string, UserProfile>();

  // Check account age requirements
  const accountRequiredAgeDays = context.config.taskAccessControl.accountRequiredAge?.minimumDays ?? 0;
  if (accountRequiredAgeDays > 0) {
    try {
      const accountAgeResult = await checkAccountAge(context, allUsers, userProfiles, participantRoleAndLimits, accountRequiredAgeDays);

      if (accountAgeResult.messages.length > 0) {
        const message = accountAgeResult.messages.join("\n");
        const warning = context.logger.warn(message, { accountRequiredAgeDays, ageMetadata: accountAgeResult.metadata });
        errors.push(warning);
      }
    } catch (err) {
      if (err instanceof Error) {
        errors.push(context.logger.error(err.message));
      }
    }
  }

  // Check experience requirements
  try {
    const experienceResult = await checkExperience(context, allUsers, participantRoleAndLimits, labels);

    if (experienceResult.messages.length > 0) {
      const message = experienceResult.messages.join("\n");
      const warning = context.logger.warn(message, { requiredExperience: experienceResult.requiredExperience, xpMetadata: experienceResult.metadata });
      errors.push(warning);
    }
  } catch (err) {
    if (err instanceof Error) {
      errors.push(context.logger.error(err.message));
    }
  }

  const toAssign: string[] = [];
  for (const user of allUsers) {
    let role: ReturnType<typeof getTransformedRole> | undefined = undefined;
    try {
      const res = await handleTaskLimitChecks({ context, logger: context.logger, sender: sender.login, username: user });
      // capture issues for later comment and API response
      res.issues.forEach((issue) => {
        assignedIssues.push({ title: issue.title, html_url: issue.html_url });
      });
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
