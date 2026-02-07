import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";

export function assignTableComment({ taskDeadline, registeredWallet, isTaskStale, daysElapsedSinceTaskCreation, warnings }: AssignTableCommentParams) {
  const elements: string[] = ["<samp>", "<table>"];

  const warningMessages: string[] = [];
  if (isTaskStale) {
    warningMessages.push(
      `This task was created over ${daysElapsedSinceTaskCreation} days ago. Please confirm that this issue specification is accurate before starting.`
    );
  }
  if (warnings && warnings.length > 0) {
    warnings.forEach((warning) => {
      warningMessages.push(warning.logMessage.raw);
    });
  }
  if (warningMessages.length > 0) {
    elements.push("<tr>", "<td>Warning!</td>", `<td>${warningMessages.join("<br>")}</td>`, "</tr>");
  }

  if (taskDeadline) {
    elements.push("<tr>", "<td>Deadline</td>", `<td>${taskDeadline}</td>`, "</tr>");
  }

  elements.push("<tr>", "<td>Beneficiary</td>", `<td>${registeredWallet}</td>`, "</tr>", "</table>", "</samp>");

  return elements.join("\n");
}

interface AssignTableCommentParams {
  taskDeadline: string | null;
  registeredWallet: string;
  isTaskStale: boolean;
  daysElapsedSinceTaskCreation: number;
  warnings?: LogReturn[];
}
