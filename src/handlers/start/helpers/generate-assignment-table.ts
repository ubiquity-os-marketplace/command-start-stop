import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";

export function assignTableComment({ taskDeadline, registeredWallet, warnings }: AssignTableCommentParams) {
  const elements: string[] = ["<samp>", "<table>"];

  if (warnings && warnings.length > 0) {
    const warningMessages = warnings.map((warning) => warning.logMessage.raw);
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
  warnings?: LogReturn[];
}
