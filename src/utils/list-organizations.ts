import { AssignedIssueScope, Context, GitHubIssueSearch } from "../types";

export async function listOrganizations(context: Context): Promise<string[]> {
  const {
    config: { assignedIssueScope },
    logger,
    payload,
  } = context;

  if (assignedIssueScope === AssignedIssueScope.REPO || assignedIssueScope === AssignedIssueScope.ORG) {
    return [payload.repository.owner.login];
  } else if (assignedIssueScope === AssignedIssueScope.NETWORK) {
    const orgsSet: Set<string> = new Set();
    const urlPattern = /https:\/\/github\.com\/(\S+)\/\S+\/issues\/\d+/;

    const url = "https://raw.githubusercontent.com/ubiquity/devpool-directory/refs/heads/__STORAGE__/devpool-issues.json";
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw logger.error(`Error 404: unable to fetch file devpool-issues.json ${url}`);
      } else {
        throw logger.error("Error fetching file devpool-issues.json.", { status: response.status });
      }
    }

    const devpoolIssues: GitHubIssueSearch["items"] = await response.json();
    devpoolIssues.forEach((issue) => {
      const match = issue.html_url.match(urlPattern);
      if (match) {
        orgsSet.add(match[1]);
      }
    });

    return [...orgsSet];
  }

  throw new Error("Unknown assignedIssueScope value. Supported values: ['org', 'repo', 'network']");
}
