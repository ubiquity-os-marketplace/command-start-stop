import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Context } from "../src/types/context";
import { getOpenLinkedPullRequestsForIssue } from "../src/utils/get-linked-prs";
import { db } from "./__mocks__/db";
import issueTemplate from "./__mocks__/issue-template";
import { createContext } from "./utils";

type Issue = Context<"issue_comment.created">["payload"]["issue"];
type PayloadSender = Context["payload"]["sender"];

async function setupTests() {
  db.issue.create({
    ...issueTemplate,
  });
  db.repo.create({
    id: 1,
    html_url: "",
    full_name: "ubiquity/test-repo",
    name: "test-repo",
    owner: {
      login: "ubiquity",
      id: 1,
      type: "Organization",
    },
    issues: [],
  });
  db.users.create({
    id: 1,
    login: "user1",
    role: "contributor",
    created_at: new Date("2020-01-01T00:00:00Z").toISOString(),
    xp: 5000,
    wallet: null,
  });
}

describe("getOpenLinkedPullRequestsForIssue", () => {
  beforeEach(async () => {
    drop(db);
    jest.clearAllMocks();
    jest.resetAllMocks();
    await setupTests();
  });

  it("returns the paginated open linked pull requests", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;
    const context = await createContext(issue, sender, "");
    const paginate = jest.fn().mockResolvedValue({
      repository: {
        issue: {
          closedByPullRequestsReferences: {
            nodes: [
              {
                number: 10,
                url: "https://github.com/ubiquity/test-repo/pull/10",
                author: {
                  login: "user1",
                },
                repository: {
                  name: "test-repo",
                  owner: {
                    login: "ubiquity",
                  },
                },
              },
              {
                number: 11,
                url: "https://github.com/ubiquity/test-repo/pull/11",
                author: null,
                repository: {
                  name: "test-repo",
                  owner: {
                    login: "ubiquity",
                  },
                },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      },
    });
    context.octokit = { graphql: { paginate } } as unknown as Context["octokit"];

    const linkedPullRequests = await getOpenLinkedPullRequestsForIssue(context, {
      owner: "ubiquity",
      repository: "test-repo",
      issue: 1,
    });

    expect(paginate).toHaveBeenCalledTimes(1);
    expect(paginate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ owner: "ubiquity", repo: "test-repo", issue_number: 1 }));
    expect(linkedPullRequests).toEqual([
      {
        organization: "ubiquity",
        repository: "test-repo",
        number: 10,
        href: "https://github.com/ubiquity/test-repo/pull/10",
        author: "user1",
      },
      {
        organization: "ubiquity",
        repository: "test-repo",
        number: 11,
        href: "https://github.com/ubiquity/test-repo/pull/11",
        author: "",
      },
    ]);
  });

  it("returns an empty list when the issue has no linked open pull requests", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;
    const context = await createContext(issue, sender, "");
    const paginate = jest.fn().mockResolvedValue({
      repository: {
        issue: {
          closedByPullRequestsReferences: null,
        },
      },
    });
    context.octokit = { graphql: { paginate } } as unknown as Context["octokit"];

    await expect(
      getOpenLinkedPullRequestsForIssue(context, {
        owner: "ubiquity",
        repository: "test-repo",
        issue: 1,
      })
    ).resolves.toEqual([]);
  });

  it("drops null nodes from the paginated response", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;
    const context = await createContext(issue, sender, "");
    const paginate = jest.fn().mockResolvedValue({
      repository: {
        issue: {
          closedByPullRequestsReferences: {
            nodes: [
              null,
              {
                number: 12,
                url: "https://github.com/ubiquity/test-repo/pull/12",
                author: {
                  login: "user2",
                },
                repository: {
                  name: "test-repo",
                  owner: {
                    login: "ubiquity",
                  },
                },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      },
    });
    context.octokit = { graphql: { paginate } } as unknown as Context["octokit"];

    await expect(
      getOpenLinkedPullRequestsForIssue(context, {
        owner: "ubiquity",
        repository: "test-repo",
        issue: 1,
      })
    ).resolves.toEqual([
      {
        organization: "ubiquity",
        repository: "test-repo",
        number: 12,
        href: "https://github.com/ubiquity/test-repo/pull/12",
        author: "user2",
      },
    ]);
  });

  it("throws when the issue number is missing", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;
    const context = await createContext(issue, sender, "");

    await expect(
      getOpenLinkedPullRequestsForIssue(context, {
        owner: "ubiquity",
        repository: "test-repo",
      })
    ).rejects.toBeTruthy();
  });
});
