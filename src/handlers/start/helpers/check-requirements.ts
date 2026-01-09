import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import { Context } from "../../../types/context";
import { Issue } from "../../../types/payload";
import { getTransformedRole } from "../../../utils/get-user-task-limit-and-role";
import { ERROR_MESSAGES } from "./error-messages";

export async function checkRequirements(
  context: Context,
  issue: Context<"issue_comment.created">["payload"]["issue"] | Issue,
  userRole: ReturnType<typeof getTransformedRole>
): Promise<LogReturn | null> {
  const {
    config: { requiredLabelsToStart },
    logger,
  } = context;
  const issueLabels = (issue.labels ?? [])
    .map((label) => (typeof label === "string" ? label.toLowerCase() : label.name?.toLowerCase()))
    .filter((label): label is string => !!label);

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

      return logger.warn(errorText, {
        requiredLabelsToStart,
        issueLabels,
        issue: issue.html_url,
      });
    } else if (!currentLabelConfiguration.allowedRoles.includes(userRole)) {
      // If we found the label in the allowed list, but the user role does not match the allowed roles, then the user cannot start this task.
      const humanReadableRoles = [
        ...currentLabelConfiguration.allowedRoles.map((o) => (o === "collaborator" ? "a core team member" : `a ${o}`)),
        "an administrator",
      ].join(", or ");
      const errorText = `You must be ${humanReadableRoles} to start this task`;
      return logger.warn(errorText, {
        currentLabelConfiguration,
        issueLabels,
        issue: issue.html_url,
        userRole,
      });
    }
  }
  return null;
}
