import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Context } from "../src/types/context";
import { AssignedIssueScope, Role } from "../src/types/plugin-input";
import { getPendingOpenedPullRequests } from "../src/utils/issue";

const username = "contributor";

function createContext({ lastCommentAuthor, lastCommentAt }: { lastCommentAuthor: string; lastCommentAt: string }) {
  const issuesAndPullRequests = jest.fn();
  const listReviews = jest.fn();
  const listEventsForTimeline = jest.fn();

  const pullRequest = {
    number: 123,
    html_url: "https://github.com/ubiquity/test/pull/123",
    created_at: "2026-05-01T00:00:00Z",
    requested_reviewers: [],
  };

  const review = {
    id: 1,
    state: "CHANGES_REQUESTED",
    submitted_at: "2026-05-10T00:00:00Z",
    author_association: Role.MEMBER,
    user: {
      id: 10,
      login: "reviewer",
    },
  };

  const paginate = jest.fn((endpoint: unknown) => {
    if (endpoint === issuesAndPullRequests) {
      return [pullRequest];
    }
    if (endpoint === listReviews) {
      return [review];
    }
    if (endpoint === listEventsForTimeline) {
      return [{ event: "review_requested", created_at: "2026-05-09T00:00:00Z" }];
    }
    return [];
  });

  return {
    logger: new Logs("debug"),
    organizations: ["ubiquity"],
    config: {
      assignedIssueScope: AssignedIssueScope.ORG,
      rolesWithReviewAuthority: [Role.ADMIN, Role.OWNER, Role.MEMBER],
      reviewDelayTolerance: "1 Day",
    },
    payload: {
      repository: {
        full_name: "ubiquity/test",
        name: "test",
        owner: {
          login: "ubiquity",
        },
      },
    },
    octokit: {
      paginate,
      graphql: {
        paginate: jest.fn(() => ({
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    isResolved: false,
                    comments: {
                      nodes: [
                        {
                          createdAt: lastCommentAt,
                          author: {
                            login: lastCommentAuthor,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        })),
      },
      rest: {
        search: {
          issuesAndPullRequests,
        },
        pulls: {
          listReviews,
        },
        issues: {
          listEventsForTimeline,
        },
      },
    },
  } as unknown as Context;
}

describe("review-thread task-limit bypass", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-12T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not count a pull request against the task limit when the contributor replied last on every unresolved thread and the delay passed", async () => {
    const context = createContext({ lastCommentAuthor: username, lastCommentAt: "2026-05-10T23:00:00Z" });

    await expect(getPendingOpenedPullRequests(context, username)).resolves.toEqual([]);
  });

  it("counts a pull request against the task limit when a reviewer is the last commenter on an unresolved thread", async () => {
    const context = createContext({ lastCommentAuthor: "reviewer", lastCommentAt: "2026-05-10T23:00:00Z" });

    await expect(getPendingOpenedPullRequests(context, username)).resolves.toHaveLength(1);
  });

  it("counts a pull request against the task limit when the contributor reply is still within the delay window", async () => {
    const context = createContext({ lastCommentAuthor: username, lastCommentAt: "2026-05-11T12:00:00Z" });

    await expect(getPendingOpenedPullRequests(context, username)).resolves.toHaveLength(1);
  });
});
