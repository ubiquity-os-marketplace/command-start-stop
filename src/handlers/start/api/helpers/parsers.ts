import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { IssueUrlParts } from "./types";

export function parseIssueUrl(url: string, logger: Logs): IssueUrlParts {
  const match = url.match(/github\.com\/(.+?)\/(.+?)\/issues\/(\d+)/i);
  if (!match) {
    throw logger.error("Invalid issueUrl");
  }
  return {
    owner: match[1],
    repo: match[2],
    issue_number: Number(match[3]),
  };
}
