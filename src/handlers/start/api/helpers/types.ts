export type StartBody = {
  userId: number;
  issueUrl?: string;
  teammates?: string[];
  mode?: "validate" | "execute";
  recommend?: { topK?: number; threshold?: number };
  // Development only: allows passing login directly when Supabase lookup is unavailable
  login?: string;
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
