import { Context } from "../../types";
import { getOwnerRepoFromHtmlUrl } from "../../utils/issue";
import { getAssignmentPeriods } from "./user-assigned-timespans";

export async function hasUserBeenUnassigned(context: Context, username: string): Promise<boolean> {
  if ("issue" in context.payload) {
    const { number, html_url } = context.payload.issue;
    const { owner, repo } = getOwnerRepoFromHtmlUrl(html_url);
    const assignmentPeriods = await getAssignmentPeriods(context.octokit, { owner, repo, issue_number: number });
    return assignmentPeriods[username]?.some((period) => period.reason === "bot" || period.reason === "admin");
  }

  return false;
}
