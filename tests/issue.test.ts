import { describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Context } from "../src/types/context";
import { AssignedIssueScope, Role } from "../src/types/plugin-input";
import { getPendingOpenedPullRequests } from "../src/utils/issue";

const username = "contributor";
const reviewer = "reviewer";
const owner = "ubiquity";
const repo = "test-repo";

const pullRequest = {
  id: 1,
  number: 10,
  html_url: `https://github.com/${owner}/${repo}/pull/10`,
  created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  requested_reviewers: [],
  user: {
    id: 1,
    login: username,
  },
};

const changesRequestedReview = {
  id: 1,
  state: "CHANGES_REQUESTED",
  submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  user: {
    id: 2,
    login: reviewer,
  },
  author_association: Role.MEMBER,
};

function createContext(reviewThreads: unknown[] | null): Context {
  const rest = {
    search: {
      issuesAndPullRequests: jest.fn(),
    },
    pulls: {
      listReviews: jest.fn(),
    },
    issues: {
      listEventsForTimeline: jest.fn(),
    },
  };

  const octokit = {
    rest,
    paginate: jest.fn((endpoint) => {
      if (endpoint === rest.search.issuesAndPullRequests) {
        return [pullRequest];
      }

      if (endpoint === rest.pulls.listReviews) {
        return [changesRequestedReview];
      }

      if (endpoint === rest.issues.listEventsForTimeline) {
        return [];
      }

      return [];
    }),
    graphql:
      reviewThreads === null
        ? undefined
        : jest.fn(() => ({
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: reviewThreads,
                },
              },
            },
          })),
  };

  return {
    eventName: "issue_comment.created",
    payload: {
      repository: {
        full_name: `${owner}/${repo}`,
        name: repo,
        owner: {
          login: owner,
        },
      },
    },
    organizations: [owner],
    config: {
      assignedIssueScope: AssignedIssueScope.REPO,
      reviewDelayTolerance: "3 Days",
      rolesWithReviewAuthority: [Role.MEMBER],
    },
    octokit,
    logger: new Logs("debug"),
  } as unknown as Context;
}

function unresolvedThread(authorLogin: string, createdAt: string) {
  return {
    isResolved: false,
    comments: {
      nodes: [
        {
          author: {
            login: authorLogin,
          },
          createdAt,
        },
      ],
    },
  };
}

describe("getPendingOpenedPullRequests", () => {
  it("does not count a PR against the task limit when the assignee answered all unresolved review threads over 24 hours ago", async () => {
    const context = createContext([unresolvedThread(username, new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString())]);

    await expect(getPendingOpenedPullRequests(context, username)).resolves.toHaveLength(0);
  });

  it("continues to count a PR against the task limit when a reviewer has the last unresolved review-thread comment", async () => {
    const context = createContext([unresolvedThread(reviewer, new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString())]);

    await expect(getPendingOpenedPullRequests(context, username)).resolves.toEqual([pullRequest]);
  });

  it("continues to count a PR against the task limit when review-thread data is unavailable", async () => {
    const context = createContext(null);

    await expect(getPendingOpenedPullRequests(context, username)).resolves.toEqual([pullRequest]);
  });
});
