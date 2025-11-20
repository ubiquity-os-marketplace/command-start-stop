import { Context } from "../../../types";
import { HttpStatusCode, Result } from "../../../types/result-types";
import { StartEligibilityResult } from "../api/helpers/types";

export const ERROR_MESSAGES = {
  UNASSIGNED: "{{username}} you were previously unassigned from this task. You cannot be reassigned.",
  MAX_TASK_LIMIT: "You have reached your max task limit. Please close out some tasks before assigning new ones.",
  MAX_TASK_LIMIT_PREFIX: "You have reached your max task limit",
  MAX_TASK_LIMIT_TEAMMATE_PREFIX: "has reached their max task limit",
  ALL_TEAMMATES_REACHED: "All teammates have reached their max task limit. Please close out some tasks before assigning new ones.",
  PARENT_ISSUES: "Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues.",
  CLOSED: "This issue is closed, please choose another.",
  ALREADY_ASSIGNED: "You are already assigned to this task. Please choose another unassigned task.",
  ISSUE_ALREADY_ASSIGNED: "This issue is already assigned. Please choose another unassigned task.",
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
  MALFORMED_COMMAND: "Malformed command parameters.",
  NO_DEADLINE_LABEL: "No labels are set.",
} as const;

/**
 * This method only supports the standard plugin entrypoint error handling flow.
 *
 * **This is not meant for use with the API.**
 */
export async function handleStartErrors(context: Context, eligibility: StartEligibilityResult): Promise<Result> {
  const { logger } = context;
  const errorMessages = eligibility.errors ?? [];

  if (!errorMessages.length) {
    throw new Error(
      logger.error("handleStartErrors called but there are no errors in eligibility.", {
        eligibility,
      }).logMessage.raw
    );
  }

  // Check for unassigned errors first - these should take precedence over all other errors
  const unassignedPattern = ERROR_MESSAGES.UNASSIGNED.toLowerCase().replace("{{username}}", "").trim();
  const unassignedError = eligibility.errors?.find((e) => {
    const lowerMsg = e.logMessage.raw.toLowerCase();
    return lowerMsg.includes(unassignedPattern);
  });
  if (unassignedError) {
    throw unassignedError;
  }

  const hasParentReason = errorMessages.some((log) => log.logMessage.raw.toLowerCase().includes(ERROR_MESSAGES.PARENT_ISSUES.toLowerCase()));
  const hasPreParentReason = errorMessages.some((log) => log.logMessage.raw.toLowerCase().includes(ERROR_MESSAGES.PRICE_LABEL_REQUIRED.toLowerCase()));

  // Preserve original ordering: if pre-parent validations fail, do NOT post parent comment
  if (hasParentReason && !hasPreParentReason) {
    const message = logger.error(ERROR_MESSAGES.PARENT_ISSUES);
    await context.commentHandler.postComment(context, message);
    throw message;
  }

  // Quota-only cases: post comment with assigned issues list
  const quotaPrefixLower = ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX.toLowerCase();
  const quotaTeammatePrefixLower = ERROR_MESSAGES.MAX_TASK_LIMIT_TEAMMATE_PREFIX.toLowerCase();
  const isQuotaOnly = errorMessages.every(
    (log) => log.logMessage.raw.toLowerCase().includes(quotaTeammatePrefixLower) || log.logMessage.raw.toLowerCase().includes(quotaPrefixLower)
  );

  if (isQuotaOnly) {
    const { toAssign, assignedIssues, consideredCount } = eligibility.computed;
    if (toAssign.length === 0 && consideredCount > 1) {
      const allTeammatesPattern = "All teammates have reached";
      const error = errorMessages.find((e) => e.logMessage.raw.includes(allTeammatesPattern));
      if (error) throw error;
    } else if (toAssign.length === 0) {
      const error = errorMessages.find((e) => e.logMessage.raw.includes(ERROR_MESSAGES.MAX_TASK_LIMIT_PREFIX));
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

  if (errorMessages.length > 1) {
    throw new AggregateError(errorMessages.map((e) => new Error(e.logMessage.raw)));
  }

  throw errorMessages[0];
}
