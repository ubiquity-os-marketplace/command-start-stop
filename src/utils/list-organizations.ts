import { Context } from "../types/context";
import { AssignedIssueScope } from "../types/plugin-input";

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
      const payload = { status: response.status };
      if (response.status >= 500) {
        throw logger.error(`Error fetching file devpool-issues.json.`, payload);
      }
      throw logger.warn(`Error fetching file devpool-issues.json.`, payload);
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

  throw logger.warn("Unknown assignedIssueScope value. Supported values: ['org', 'repo', 'network']", { assignedIssueScope, payload });
}
