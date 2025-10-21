import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type Issue = RestEndpointMethodTypes["issues"]["get"]["response"]["data"];
export type Review = RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][0];
export type TimelineEventResponse = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"];
export type TimelineEvents = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][0];
export type Assignee = Issue["assignee"];
export type GitHubIssueSearch = RestEndpointMethodTypes["search"]["issuesAndPullRequests"]["response"]["data"];
export type PrState = "open" | "closed" | "all" | undefined;

export type AssignedIssue = {
  title: string;
  html_url: string;
};

export type Sender = { login: string; id: number };

export const ISSUE_TYPE = {
  OPEN: "open",
  CLOSED: "closed",
} as const;
