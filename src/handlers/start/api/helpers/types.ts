export type StartBody = {
  userId: number;
  issueUrl?: string;
  teammates?: string[];
  mode?: "validate" | "execute";
  recommend?: { topK?: number; threshold?: number };
  // Development only: allows passing login directly when Supabase lookup is unavailable
  login?: string;
  // Optional: GitHub user OAuth access token used when the GitHub App isn't installed on the repo
  userAccessToken?: string;
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
