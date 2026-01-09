import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import { Context } from "../../types/context";
import { AssignedIssue, ISSUE_TYPE, Label } from "../../types/payload";
import { getTransformedRole, getUserRoleAndTaskLimit } from "../../utils/get-user-task-limit-and-role";
import { getTimeValue, isParentIssue } from "../../utils/issue";
import { DeepPartial, StartEligibilityResult } from "./api/helpers/types";
import { checkAccountAge, UserProfile } from "./helpers/check-account-age";
import { handleTaskLimitChecks } from "./helpers/check-assignments";
import { checkExperience } from "./helpers/check-experience";
import { checkRequirements } from "./helpers/check-requirements";
import { checkTaskStale } from "./helpers/check-task-stale";
import { ERROR_MESSAGES } from "./helpers/error-messages";
import { getDeadline } from "./helpers/get-deadline";

function unableToStartError({ override }: { override?: DeepPartial<StartEligibilityResult> }): StartEligibilityResult {
  return {
    ok: false,
    errors: [...(override?.errors ?? []).filter((e): e is LogReturn => !!e)],
    warnings: [...(override?.warnings ?? []).filter((w): w is LogReturn => !!w)],
    computed: {
      deadline: override?.computed?.deadline ?? null,
      isTaskStale: override?.computed?.isTaskStale ?? null,
      wallet: override?.computed?.wallet ?? null,
      toAssign: [...(override?.computed?.toAssign ?? []).filter((u): u is string => !!u)],
      assignedIssues: [...(override?.computed?.assignedIssues ?? []).filter((i): i is AssignedIssue => !!i)],
      consideredCount: override?.computed?.consideredCount ?? 0,
      senderRole: override?.computed?.senderRole ?? "contributor",
    },
  };
}

export async function evaluateStartEligibility(
  context: Context<"issue_comment.created"> & { installOctokit: Context["octokit"] }
): Promise<StartEligibilityResult> {
  const errors: LogReturn[] = [];
  const warnings: LogReturn[] = [];
  const assignedIssues: AssignedIssue[] = [];
  const {
    payload: { issue, sender },
  } = context;

  if ((typeof sender === "object" && !sender.login) || !sender) {
    errors.push(context.logger.warn(ERROR_MESSAGES.MISSING_SENDER));
    return unableToStartError({ override: { errors } });
  }

  const labels = (issue.labels ?? []) as Label[];
  const priceLabel = labels.find((label: Label) => label.name.startsWith("Price: "));
  const userAssociation = await getUserRoleAndTaskLimit(context, sender.login);
  const userRole = userAssociation.role;

  // Contributors need price label
  if (!priceLabel && userRole === "contributor") {
    errors.push(context.logger.warn(ERROR_MESSAGES.PRICE_LABEL_REQUIRED));
    return unableToStartError({ override: { errors } });
  }

  const checkReqErr = await checkRequirements(context, issue, userRole);
  if (checkReqErr) {
    errors.push(checkReqErr);
    return unableToStartError({ override: { errors } });
  }

  if (issue.body && isParentIssue(issue.body)) {
    errors.push(context.logger.warn(ERROR_MESSAGES.PARENT_ISSUES));
    return unableToStartError({ override: { errors } });
  }

  if (issue.state === ISSUE_TYPE.CLOSED) {
    errors.push(context.logger.warn(ERROR_MESSAGES.CLOSED));
    return unableToStartError({ override: { errors } });
  }

  const assignees = issue?.assignees ?? [];
  if (assignees.length) {
    // Check if the sender is already assigned to this issue
    const isSenderAssigned = assignees.some((assignee) => assignee?.login?.toLowerCase() === sender.login.toLowerCase());
    const errorMessage = isSenderAssigned ? ERROR_MESSAGES.ALREADY_ASSIGNED : ERROR_MESSAGES.ISSUE_ALREADY_ASSIGNED;
    errors.push(context.logger.warn(errorMessage));
    return unableToStartError({ override: { errors } });
  }

  const params =
    context.command && "parameters" in context.command
      ? context.command.parameters
      : {
          teammates: [],
        };

  const allUsers = [...new Set([sender.login, ...(params.teammates ?? []).map((u: string) => u.trim()).filter((u: string) => u.length > 0)])];

  // Build participant role mappings for access control checks
  const participantRoleAndLimits: Map<string, { role: ReturnType<typeof getTransformedRole>; limit: number }> = new Map();
  participantRoleAndLimits.set(sender.login.toLowerCase(), { role: userRole, limit: userAssociation.limit });

  const roleFetches = allUsers
    .filter((username) => !participantRoleAndLimits.has(username.toLowerCase()))
    .map(async (username) => {
      const association = await getUserRoleAndTaskLimit(context, username);
      participantRoleAndLimits.set(username.toLowerCase(), { role: association.role, limit: association.limit });
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
        return unableToStartError({ override: { errors } });
      }
    } catch (err) {
      if (err instanceof Error) {
        errors.push(context.logger.error(err.message));
        return unableToStartError({ override: { errors } });
      }
    }
  }

  // Check experience requirements
  try {
    const { messages = [], metadata, requiredExperience } = await checkExperience(context, allUsers, participantRoleAndLimits, labels);

    if (messages.length > 0 && requiredExperience && requiredExperience > 0) {
      const message = messages.join("\n");
      const warning = context.logger.warn(message, { requiredExperience, xpMetadata: metadata });
      errors.push(warning);
      return unableToStartError({ override: { errors } });
    }

    if (messages.length == 1 && messages.includes("@" + sender.login + " - unable to verify experience at this time.")) {
      const message = messages.join("\n");
      const warning = context.logger.warn(message, { requiredExperience, xpMetadata: metadata });
      warnings.push(warning);
    }
  } catch (err) {
    if (err instanceof Error) {
      errors.push(context.logger.error(err.message));
      return unableToStartError({ override: { errors } });
    }
  }

  const toAssign: string[] = [];
  for (const user of allUsers) {
    const roleAndLimit = participantRoleAndLimits.get(user.toLowerCase());
    try {
      const res = await handleTaskLimitChecks({ context, logger: context.logger, sender: sender.login, username: user, roleAndLimit });
      // capture issues for later comment and API response
      res.assignedIssues.forEach((issue) => {
        assignedIssues.push({ title: issue.title, html_url: issue.html_url });
      });
      if (res.isUnassigned) {
        errors.push(context.logger.warn(ERROR_MESSAGES.UNASSIGNED.replace("{{username}}", user), { user }));
        continue;
      }
      // within limit?
      else if (!res.isWithinLimit) {
        const message = user === sender.login ? ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX : `${user} ${ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX}`;
        errors.push(
          context.logger.warn(message, {
            assignedIssues: res.assignedIssues.length,
            openedPullRequests: res.openedPullRequests.length,
            limit: 0,
          })
        );
        continue;
      } else {
        toAssign.push(user);
      }
    } catch (e) {
      if (e instanceof Error) {
        errors.push(context.logger.error(e.message, { username: user }));
      } else if (e instanceof LogReturn) {
        errors.push(e);
      } else {
        errors.push(context.logger.error("Unknown error during task limit checks", { username: user, e }));
      }
      continue;
    }

    if (roleAndLimit?.role === "admin") {
      // Admins have no price limit
      continue;
    }

    if (priceLabel && roleAndLimit) {
      const { usdPriceMax } = context.config.taskAccessControl;
      const min = Math.min(...Object.values(usdPriceMax));
      const allowed = roleAndLimit.role in usdPriceMax ? usdPriceMax[roleAndLimit.role as keyof typeof usdPriceMax] : undefined;
      const userAllowedMaxPrice = typeof allowed === "number" ? allowed : min;
      const match = priceLabel.name.match(/Price:\s*([\d.]+)/);
      if (!match || isNaN(parseFloat(match[1]))) {
        errors.push(context.logger.warn(ERROR_MESSAGES.PRICE_LABEL_FORMAT_ERROR, { priceLabel: priceLabel.name }));
      } else {
        const price = parseFloat(match[1]);
        if (userAllowedMaxPrice < 0) {
          errors.push(
            context.logger.warn(ERROR_MESSAGES.PRESERVATION_MODE, { userRole: roleAndLimit.role, price, userAllowedMaxPrice, issueNumber: issue.number })
          );
        } else if (price > userAllowedMaxPrice) {
          errors.push(
            context.logger.warn(
              ERROR_MESSAGES.PRICE_LIMIT_EXCEEDED.replace("{{user}}", user).replace("{{userAllowedMaxPrice}}", userAllowedMaxPrice.toString()),
              { userRole: roleAndLimit.role, price, userAllowedMaxPrice, issueNumber: issue.number }
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
      errors.push(context.logger.warn(message));
    }

    return unableToStartError({ override: { errors } });
  }

  // Wallet
  let wallet: string | null = null;
  try {
    wallet = await context.adapters.supabase.user.getWalletByUserId(sender.id, issue.number);
  } catch {
    /**
     * Swallow errors here as this is more of a nudge for the user to set their wallet,
     * it shouldn't prevent them from starting a task.
     *
     * Returning this as a warning via the API makes more sense.
     */
    warnings.push(context.logger.warn(context.config.emptyWalletText));
  }

  // Staleness & deadline
  const isTaskStale = checkTaskStale(getTimeValue(context.config.taskStaleTimeoutDuration), issue.created_at);
  if (isTaskStale) {
    warnings.push(context.logger.warn(ERROR_MESSAGES.TASK_STALE));
  }

  const deadline = getDeadline(labels);
  if (!deadline) {
    const msg = ERROR_MESSAGES.NO_DEADLINE_LABEL;
    warnings.push(context.logger.warn(msg));
  }

  return {
    ok: errors.length === 0,
    errors: errors.length > 0 ? errors : null,
    warnings: warnings.length > 0 ? warnings : null,
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
