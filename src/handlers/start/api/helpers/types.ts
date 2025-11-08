export type StartBody = {
  userId: number;
  issueUrl: string;
  mode: "validate" | "execute";
  // Optional: GitHub OAuth access token (of any kind, e.g., user or app) 
  userAccessToken?: string;
  // Optional: Multi-assignee support - list of teammates to assign along with the user
  teammates?: string[];
};

export type IssueUrlParts = {
  owner: string;
  repo: string;
  issue_number: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};
