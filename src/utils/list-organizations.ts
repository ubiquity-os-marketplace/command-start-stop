import { AssignedIssueScope, Context } from "../types/index";

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

    const url = "https://raw.githubusercontent.com/devpool-directory/devpool-directory/refs/heads/__STORAGE__/issues-map.json";
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw logger.error(`Error 404: unable to fetch file devpool-issues.json ${url}`);
      } else {
        throw logger.error("Error fetching file devpool-issues.json.", { status: response.status });
      }
    }

    const devpoolStorage = await response.json();

    if (devpoolStorage instanceof Map) {
      for (const [, issueData] of devpoolStorage) {
        const match = issueData.url.match(urlPattern);
        if (match) {
          orgsSet.add(match[1]);
        }
      }
    } else {
      for (const issueId of Object.keys(devpoolStorage)) {
        const issueData = devpoolStorage[issueId];
        const match = issueData.url.match(urlPattern);
        if (match) {
          orgsSet.add(match[1]);
        }
      }
    }

    return [...orgsSet];
  }

  throw new Error("Unknown assignedIssueScope value. Supported values: ['org', 'repo', 'network']");
}
