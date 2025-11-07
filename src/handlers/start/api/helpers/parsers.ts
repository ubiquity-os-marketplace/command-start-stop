import { IssueUrlParts } from "./types";

export function parseIssueUrl(url: string): IssueUrlParts {
  const match = url.match(/github\.com\/(.+?)\/(.+?)\/issues\/(\d+)/i);
  if (!match) {
    throw new Error("Invalid issueUrl");
  }
  return {
    owner: match[1],
    repo: match[2],
    issue_number: Number(match[3]),
  };
}
