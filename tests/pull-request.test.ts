import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Repository } from "@octokit/graphql-schema";
import dotenv from "dotenv";
import { ERROR_MESSAGES } from "../src/handlers/start/helpers/error-messages";
import { Context } from "../src/types/context";
import { HttpStatusCode } from "../src/types/result-types";
import { db } from "./__mocks__/db";
import issueTemplate from "./__mocks__/issue-template";
import { server } from "./__mocks__/node";
import { createContext } from "./utils";

dotenv.config();

const userLogin = "user2";
const ONE_HOUR_TIME_LABEL = "Time: <1 Hour";
const CLOSE_FAILURE = "close failure";
const SUCCESS_MESSAGE = ERROR_MESSAGES.TASK_ASSIGNED;
const PULL_REQUEST_EVENT_NAME = "pull_request.opened";
const PULL_REQUEST_EDITED_EVENT_NAME = "pull_request.edited";
const PULL_REQUEST_HTML_URL = "https://github.com/ubiquity-os-marketplace/command-start-stop";
const SUPABASE_MODULE_PATH = "@supabase/supabase-js";
const ADAPTERS_MODULE_PATH = "../src/adapters";
const SDK_OCTOKIT_MODULE_PATH = "@ubiquity-os/plugin-sdk/octokit";
const OCTOKIT_HELPERS_MODULE_PATH = "../src/handlers/start/api/helpers/octokit";
const START_TASK_MODULE_PATH = "../src/handlers/start-task";
const OWNERSHIP_RECEIPT_PREFIX = "<!-- uos-command-start-stop:ownership-receipt:v1\n";
const LATER_PULL_REQUEST_UPDATE = "2026-10-18T20:01:00Z";

type Issue = Context<"issue_comment.created">["payload"]["issue"];
type PayloadSender = Context["payload"]["sender"];
type OwnershipComment = {
  id: number;
  body: string;
  user: { id: number; type: string };
  performed_via_github_app: { id: number };
};

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => server.close());

async function setupTests() {
  db.issue.create({
    ...issueTemplate,
    labels: [{ name: "Priority: 1 (Normal)", description: "collaborator only" }, ...issueTemplate.labels],
  });

  db.repo.create({
    id: 1,
    html_url: "",
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
    login: "ubiquity",
    role: "admin",
    created_at: new Date("2020-01-01T00:00:00Z").toISOString(),
    xp: 5000,
    wallet: null,
  });
  db.users.create({
    id: 2,
    login: "user2",
    role: "contributor",
    created_at: "2024-07-01T00:00:00.000Z",
    xp: 200,
    wallet: null,
  });
}

function createLinkedIssueRepoOctokit(issue: Issue, repo: Repository, role = "contributor") {
  return {
    paginate: jest.fn(() => Promise.resolve([])),
    rest: {
      apps: {
        getRepoInstallation: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
      },
      issues: {
        get: jest.fn(() => Promise.resolve({ data: { ...issue, labels: issue.labels } })),
        listEvents: jest.fn(() => Promise.resolve({ data: [] })),
        listComments: jest.fn(() => Promise.resolve({ data: [] })),
        listForRepo: jest.fn(() => Promise.resolve({ data: [] })),
        addAssignees: jest.fn(() => Promise.resolve({ data: {} })),
      },
      search: {
        issuesAndPullRequests: jest.fn(() => Promise.resolve({ data: { items: [] } })),
      },
      repos: {
        get: jest.fn(() => Promise.resolve({ data: repo })),
        getCollaboratorPermissionLevel: jest.fn(() => Promise.resolve({ data: { role_name: role } })),
        getCommit: jest.fn(() => Promise.resolve({ data: { sha: "1234567890abcdef" } })),
      },
      orgs: {
        get: jest.fn(() => Promise.resolve({ data: repo?.owner })),
        getMembershipForUser: jest.fn(() => ({ data: { role } })),
      },
      users: {
        getByUsername: jest.fn(({ username }) => {
          const user = db.users.findFirst({ where: { login: { equals: username as string } } });
          if (!user) {
            return Promise.reject(new Error("User not found"));
          }
          return Promise.resolve({
            data: {
              login: user.login,
              id: user.id,
              created_at: user.created_at,
              type: "User",
              site_admin: false,
              name: user.login,
              avatar_url: `https://avatars.githubusercontent.com/u/${user.id}`,
              html_url: `https://github.com/${user.login}`,
              email: null,
              bio: null,
            },
          });
        }),
      },
    },
  } as const;
}

async function createPullRequestEventContext(
  issue: Issue,
  sender: PayloadSender,
  eventName: "pull_request.opened" | "pull_request.edited" = PULL_REQUEST_EVENT_NAME
) {
  const context = (await createContext(issue, sender, "")) as Context<"pull_request.opened" | "pull_request.edited">;
  context.eventName = eventName;
  context.payload.action = eventName === PULL_REQUEST_EDITED_EVENT_NAME ? "edited" : "opened";
  context.env.APP_ID = "1";
  context.payload.pull_request = {
    html_url: PULL_REQUEST_HTML_URL,
    number: 1,
    user: {
      id: 2,
      login: userLogin,
    },
    head: { sha: "a".repeat(40), ref: "ownership-receipt" },
    base: { sha: "b".repeat(40), ref: "main" },
    updated_at: "2026-10-18T20:00:00Z",
  } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
  context.commentHandler = {
    postComment: jest.fn(async () => null),
    createCommentBody: jest.fn((commentContext: Context, message: { logMessage: { diff: string } }) => message.logMessage.diff),
  } as unknown as Context["commentHandler"];
  return context;
}

function expectWarnFormattedPullRequestComment(commentMock: ReturnType<typeof jest.fn>, message: string) {
  expect(commentMock).toHaveBeenCalledTimes(1);

  const [{ body }] = commentMock.mock.calls[0] as [{ body: string }];
  expect(body).toBe(`> [!WARNING]\n> ${message}`);
}

function readOwnershipReceipt(body: string) {
  expect(body.startsWith(OWNERSHIP_RECEIPT_PREFIX)).toBe(true);
  return JSON.parse(body.slice(OWNERSHIP_RECEIPT_PREFIX.length, body.indexOf("\n-->", OWNERSHIP_RECEIPT_PREFIX.length))) as Record<string, unknown>;
}

function createClosingIssueNode(
  repo: Repository,
  { assignees = [], number = 1, state = "OPEN" }: { assignees?: string[]; number?: number; state?: string } = {}
) {
  return {
    assignees: {
      nodes: assignees.map((login) => ({ login })),
    },
    number,
    repository: repo,
    state,
  };
}

function setPullRequestOctokit(
  context: Context<"pull_request.opened" | "pull_request.edited">,
  {
    nodes = null,
    commentMock = jest.fn(),
    updateMock = jest.fn(),
    comments = [],
    receiptUpdateMock = jest.fn(),
  }: {
    nodes?: unknown[] | null;
    commentMock?: ReturnType<typeof jest.fn>;
    updateMock?: ReturnType<typeof jest.fn>;
    comments?: OwnershipComment[];
    receiptUpdateMock?: ReturnType<typeof jest.fn>;
  } = {}
) {
  context.octokit = {
    rest: {
      pulls: {
        update: updateMock,
      },
      issues: {
        createComment: commentMock,
        listComments: jest.fn(),
        updateComment: receiptUpdateMock,
      },
    },
    paginate: jest.fn(() => Promise.resolve(comments)),
    graphql: {
      paginate: jest.fn(() =>
        Promise.resolve({
          repository: {
            pullRequest: {
              closingIssuesReferences: nodes === null ? null : { nodes },
            },
          },
        })
      ),
    },
  } as unknown as Context<"pull_request.edited">["octokit"];

  return { commentMock, updateMock, receiptUpdateMock };
}

async function mockRepoOctokitModules(repoOctokit: unknown, createAdaptersMock: ReturnType<typeof jest.fn> = jest.fn()) {
  jest.doMock(SUPABASE_MODULE_PATH, () => ({
    createClient: jest.fn(),
  }));
  jest.doMock(ADAPTERS_MODULE_PATH, () => ({
    createAdapters: createAdaptersMock,
  }));
  jest.doMock(SDK_OCTOKIT_MODULE_PATH, () => ({
    customOctokit: jest.fn().mockReturnValue(repoOctokit),
  }));
  jest.doMock(OCTOKIT_HELPERS_MODULE_PATH, () => ({
    createUserOctokit: jest.fn(() => Promise.resolve(repoOctokit)),
    createAppOctokit: jest.fn(() => Promise.resolve(repoOctokit)),
    createRepoOctokit: jest.fn(() => Promise.resolve(repoOctokit)),
  }));
}

async function setupOwnershipReceipt() {
  const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
  const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
  const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
  const repoOctokit = createLinkedIssueRepoOctokit(issue, repo);
  const context = await createPullRequestEventContext(issue, sender, PULL_REQUEST_EDITED_EVENT_NAME);
  const comments: OwnershipComment[] = [];
  const commentMock = jest.fn(async ({ body }: { body: string }) => {
    const comment = { id: comments.length + 1, body, user: { id: 1, type: "Bot" }, performed_via_github_app: { id: 1 } };
    comments.push(comment);
    return { data: comment };
  });
  const receiptUpdateMock = jest.fn(async ({ body, comment_id: commentId }: { body: string; comment_id: number }) => {
    const comment = comments.find((candidate) => candidate.id === commentId);
    if (!comment) throw new Error("Synthetic comment not found");
    comment.body = body;
    return { data: comment };
  });
  const { updateMock } = setPullRequestOctokit(context, {
    nodes: [createClosingIssueNode(repo, { number: issue.number, assignees: [userLogin] })],
    comments,
    commentMock,
    receiptUpdateMock,
  });
  await mockRepoOctokitModules(repoOctokit);
  const startTask = jest.fn().mockResolvedValue({ status: HttpStatusCode.OK });
  jest.doMock(START_TASK_MODULE_PATH, () => ({ startTask }));
  const { startStopTask } = await import("../src/plugin");
  return { context, comments, commentMock, receiptUpdateMock, updateMock, startTask, repoOctokit, run: () => startStopTask(context) };
}

describe("Pull-request tests", () => {
  beforeEach(async () => {
    drop(db);
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules();
    jest.unmock(START_TASK_MODULE_PATH);
    await setupTests();
  });

  it("Should properly handle a pull-request without a price label", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    issue.labels = [];
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const missingPriceRepoOctokit = {
      rest: {
        apps: {
          getRepoInstallation: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
        },
        issues: {
          get: jest.fn(() => Promise.resolve({ data: { ...issue, labels: [{ name: ONE_HOUR_TIME_LABEL }] } })),
        },
        repos: {
          get: jest.fn(() => Promise.resolve({ data: repo })),
        },
        orgs: {
          get: jest.fn(() => Promise.resolve({ data: repo?.owner })),
        },
      },
    } as const;

    const context = (await createContext(issue, sender, "")) as Context<"pull_request.opened">;
    context.eventName = PULL_REQUEST_EVENT_NAME;
    context.payload.pull_request = {
      html_url: PULL_REQUEST_HTML_URL,
      number: 1,
      user: {
        id: 2,
        login: userLogin,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.octokit = {
      rest: {
        pulls: {
          update: jest.fn(),
        },
        issues: {
          createComment: jest.fn(),
        },
      },
      graphql: {
        paginate: jest.fn(() =>
          Promise.resolve({
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  nodes: [
                    {
                      assignees: {
                        nodes: [],
                      },
                      repository: repo,
                    },
                  ],
                },
              },
            },
          })
        ),
      },
    } as unknown as Context<"pull_request.edited">["octokit"];
    jest.mock(SUPABASE_MODULE_PATH, () => ({
      createClient: jest.fn(),
    }));
    jest.mock(ADAPTERS_MODULE_PATH, () => ({
      createAdapters: jest.fn(),
    }));
    jest.mock(SDK_OCTOKIT_MODULE_PATH, () => ({
      customOctokit: jest.fn().mockReturnValue(missingPriceRepoOctokit),
    }));
    jest.mock(OCTOKIT_HELPERS_MODULE_PATH, () => ({
      createUserOctokit: jest.fn(() => missingPriceRepoOctokit),
      createAppOctokit: jest.fn(() => missingPriceRepoOctokit),
      createRepoOctokit: jest.fn(() => Promise.resolve(missingPriceRepoOctokit)),
    }));
    context.commentHandler = {
      postComment: jest.fn(async () => null),
    } as unknown as Context["commentHandler"];
    const octokitHelpers = await import(OCTOKIT_HELPERS_MODULE_PATH);
    jest.spyOn(octokitHelpers, "createRepoOctokit").mockResolvedValue(missingPriceRepoOctokit as never);
    const { startStopTask } = await import("../src/plugin");
    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: expect.stringContaining("You may not start the task because the issue requires a price label. Please ask a maintainer to add pricing."),
    });
    expect(context.octokit.rest.pulls.update).toHaveBeenCalledTimes(1);
  });

  it("Should properly handle a pull-request with a price label", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    // Add a price label so the business priority check is reached
    issue.labels = [
      { name: "Price: $100", color: "#000000", default: false, description: null, id: 1, node_id: "1", url: "" },
      { name: ONE_HOUR_TIME_LABEL, color: "#000000", default: false, description: null, id: 2, node_id: "2", url: "" },
    ];
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;

    const context = (await createContext(issue, sender, "")) as Context<"pull_request.opened">;
    context.eventName = PULL_REQUEST_EVENT_NAME;
    context.payload.pull_request = {
      html_url: PULL_REQUEST_HTML_URL,
      number: 1,
      user: {
        id: 2,
        login: userLogin,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.octokit = {
      rest: {
        pulls: {
          update: jest.fn(),
        },
        issues: {
          createComment: jest.fn(),
        },
      },
      graphql: {
        paginate: jest.fn(() =>
          Promise.resolve({
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  nodes: [
                    {
                      assignees: {
                        nodes: [],
                      },
                      repository: repo,
                    },
                  ],
                },
              },
            },
          })
        ),
      },
    } as unknown as Context<"pull_request.edited">["octokit"];
    const pricedRepoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    jest.mock(SUPABASE_MODULE_PATH, () => ({
      createClient: jest.fn(),
    }));
    jest.mock(ADAPTERS_MODULE_PATH, () => ({
      createAdapters: jest.fn(() => ({
        supabase: {
          user: {
            getWalletByUserId: jest.fn(() => Promise.resolve(null)),
          },
        },
      })),
    }));
    jest.mock(SDK_OCTOKIT_MODULE_PATH, () => ({
      customOctokit: jest.fn().mockReturnValue(pricedRepoOctokit),
    }));
    jest.mock(OCTOKIT_HELPERS_MODULE_PATH, () => ({
      createUserOctokit: jest.fn(() => Promise.resolve(pricedRepoOctokit)),
      createAppOctokit: jest.fn(() => Promise.resolve(pricedRepoOctokit)),
      createRepoOctokit: jest.fn(() => Promise.resolve(pricedRepoOctokit)),
    }));
    context.commentHandler = {
      postComment: jest.fn(async () => null),
    } as unknown as Context["commentHandler"];
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: expect.stringContaining(
        ERROR_MESSAGES.NOT_BUSINESS_PRIORITY.replace(
          "{{requiredLabelsToStart}}",
          "`Priority: 1 (Normal)`, `Priority: 2 (Medium)`, `Priority: 3 (High)`, `Priority: 4 (Urgent)`, `Priority: 5 (Emergency)`"
        )
      ),
    });
    expect(context.octokit.rest.pulls.update).toHaveBeenCalledTimes(1);
  });

  it("Should close the pull-request when start is rejected by preservation mode", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const preservedRepoOctokit = createLinkedIssueRepoOctokit(issue, repo);

    const context = (await createContext(issue, sender, "")) as Context<"pull_request.opened">;
    context.eventName = PULL_REQUEST_EVENT_NAME;
    context.config.taskAccessControl.usdPriceMax.contributor = -1;
    context.payload.pull_request = {
      html_url: PULL_REQUEST_HTML_URL,
      number: 1,
      user: {
        id: 2,
        login: userLogin,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.octokit = {
      rest: {
        pulls: {
          update: jest.fn(),
        },
        issues: {
          createComment: jest.fn(),
        },
      },
      graphql: {
        paginate: jest.fn(() =>
          Promise.resolve({
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  nodes: [
                    {
                      assignees: {
                        nodes: [],
                      },
                      repository: repo,
                    },
                  ],
                },
              },
            },
          })
        ),
      },
    } as unknown as Context<"pull_request.edited">["octokit"];
    jest.mock(SUPABASE_MODULE_PATH, () => ({
      createClient: jest.fn(),
    }));
    jest.mock(ADAPTERS_MODULE_PATH, () => ({
      createAdapters: jest.fn(() => ({
        supabase: {
          user: {
            getWalletByUserId: jest.fn(() => Promise.resolve(null)),
          },
        },
      })),
    }));
    jest.mock(SDK_OCTOKIT_MODULE_PATH, () => ({
      customOctokit: jest.fn().mockReturnValue(preservedRepoOctokit),
    }));
    jest.mock(OCTOKIT_HELPERS_MODULE_PATH, () => ({
      createUserOctokit: jest.fn(() => Promise.resolve(preservedRepoOctokit)),
      createAppOctokit: jest.fn(() => Promise.resolve(preservedRepoOctokit)),
      createRepoOctokit: jest.fn(() => Promise.resolve(preservedRepoOctokit)),
    }));
    context.commentHandler = {
      postComment: jest.fn(async () => null),
    } as unknown as Context["commentHandler"];
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: ERROR_MESSAGES.PRESERVATION_MODE,
    });
    expect(context.octokit.rest.pulls.update).toHaveBeenCalledTimes(1);
  });

  it("Should preserve the rejected start result when closing the pull-request fails", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    issue.labels = [];
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const missingPriceRepoOctokit = {
      rest: {
        apps: {
          getRepoInstallation: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
        },
        issues: {
          get: jest.fn(() => Promise.resolve({ data: { ...issue, labels: [{ name: ONE_HOUR_TIME_LABEL }] } })),
        },
        repos: {
          get: jest.fn(() => Promise.resolve({ data: repo })),
        },
        orgs: {
          get: jest.fn(() => Promise.resolve({ data: repo?.owner })),
        },
      },
    } as const;

    const context = (await createContext(issue, sender, "")) as Context<"pull_request.opened">;
    context.eventName = PULL_REQUEST_EVENT_NAME;
    context.payload.pull_request = {
      html_url: PULL_REQUEST_HTML_URL,
      number: 1,
      user: {
        id: 2,
        login: userLogin,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.octokit = {
      rest: {
        pulls: {
          update: jest.fn(() => Promise.reject(new Error(CLOSE_FAILURE))),
        },
        issues: {
          createComment: jest.fn(),
        },
      },
      graphql: {
        paginate: jest.fn(() =>
          Promise.resolve({
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  nodes: [
                    {
                      assignees: {
                        nodes: [],
                      },
                      repository: repo,
                    },
                  ],
                },
              },
            },
          })
        ),
      },
    } as unknown as Context<"pull_request.edited">["octokit"];
    jest.mock(SUPABASE_MODULE_PATH, () => ({
      createClient: jest.fn(),
    }));
    jest.mock(ADAPTERS_MODULE_PATH, () => ({
      createAdapters: jest.fn(),
    }));
    jest.mock(SDK_OCTOKIT_MODULE_PATH, () => ({
      customOctokit: jest.fn().mockReturnValue(missingPriceRepoOctokit),
    }));
    jest.mock(OCTOKIT_HELPERS_MODULE_PATH, () => ({
      createUserOctokit: jest.fn(() => missingPriceRepoOctokit),
      createAppOctokit: jest.fn(() => missingPriceRepoOctokit),
      createRepoOctokit: jest.fn(() => Promise.resolve(missingPriceRepoOctokit)),
    }));
    context.commentHandler = {
      postComment: jest.fn(async () => null),
    } as unknown as Context["commentHandler"];
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: expect.stringContaining(ERROR_MESSAGES.PRICE_LABEL_REQUIRED),
    });
    expect(context.octokit.rest.pulls.update).toHaveBeenCalledTimes(1);
  });

  it("Should preserve the original start error when closing the pull-request fails", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const thrownStartError = new Error("original start failure");
    const repoOctokit = {
      rest: {
        apps: {
          getRepoInstallation: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
        },
        issues: {
          get: jest.fn(() => Promise.resolve({ data: issue })),
        },
        repos: {
          get: jest.fn(() => Promise.resolve({ data: repo })),
        },
        orgs: {
          get: jest.fn(() => Promise.resolve({ data: repo?.owner })),
        },
      },
    } as const;

    const context = (await createContext(issue, sender, "")) as Context<"pull_request.opened">;
    context.eventName = PULL_REQUEST_EVENT_NAME;
    context.payload.pull_request = {
      html_url: PULL_REQUEST_HTML_URL,
      number: 1,
      user: {
        id: 2,
        login: userLogin,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.octokit = {
      rest: {
        pulls: {
          update: jest.fn(() => Promise.reject(new Error(CLOSE_FAILURE))),
        },
        issues: {
          createComment: jest.fn(),
        },
      },
      graphql: {
        paginate: jest.fn(() =>
          Promise.resolve({
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  nodes: [
                    {
                      assignees: {
                        nodes: [],
                      },
                      repository: repo,
                    },
                  ],
                },
              },
            },
          })
        ),
      },
    } as unknown as Context<"pull_request.edited">["octokit"];
    jest.mock(SUPABASE_MODULE_PATH, () => ({
      createClient: jest.fn(),
    }));
    jest.mock(ADAPTERS_MODULE_PATH, () => ({
      createAdapters: jest.fn(),
    }));
    jest.mock(OCTOKIT_HELPERS_MODULE_PATH, () => ({
      createRepoOctokit: jest.fn(() => Promise.resolve(repoOctokit)),
    }));
    jest.mock(START_TASK_MODULE_PATH, () => ({
      startTask: jest.fn(() => Promise.reject(thrownStartError)),
    }));
    context.commentHandler = {
      postComment: jest.fn(async () => null),
    } as unknown as Context["commentHandler"];
    const { startStopTask } = await import("../src/plugin");

    await expect(startStopTask(context)).rejects.toThrow(thrownStartError.message);
    expect(context.octokit.rest.pulls.update).toHaveBeenCalledTimes(1);
  });

  it("Should keep the pull-request open when the start succeeds", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const successfulRepoOctokit = createLinkedIssueRepoOctokit(issue, repo);

    const context = (await createContext(issue, sender, "")) as Context<"pull_request.opened">;
    context.eventName = PULL_REQUEST_EVENT_NAME;
    context.payload.pull_request = {
      html_url: PULL_REQUEST_HTML_URL,
      number: 1,
      user: {
        id: 2,
        login: userLogin,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.octokit = {
      rest: {
        pulls: {
          update: jest.fn(),
        },
        issues: {
          createComment: jest.fn(),
        },
      },
      graphql: {
        paginate: jest.fn(() =>
          Promise.resolve({
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  nodes: [
                    {
                      assignees: {
                        nodes: [],
                      },
                      number: issue.number,
                      repository: repo,
                    },
                  ],
                },
              },
            },
          })
        ),
      },
    } as unknown as Context<"pull_request.edited">["octokit"];
    jest.mock(SUPABASE_MODULE_PATH, () => ({
      createClient: jest.fn(),
    }));
    jest.mock(ADAPTERS_MODULE_PATH, () => ({
      createAdapters: jest.fn(() => ({
        supabase: {
          user: {
            getWalletByUserId: jest.fn(() => Promise.resolve(null)),
          },
        },
      })),
    }));
    jest.mock(SDK_OCTOKIT_MODULE_PATH, () => ({
      customOctokit: jest.fn().mockReturnValue(successfulRepoOctokit),
    }));
    jest.mock(OCTOKIT_HELPERS_MODULE_PATH, () => ({
      createUserOctokit: jest.fn(() => Promise.resolve(successfulRepoOctokit)),
      createAppOctokit: jest.fn(() => Promise.resolve(successfulRepoOctokit)),
      createRepoOctokit: jest.fn(() => Promise.resolve(successfulRepoOctokit)),
    }));
    context.commentHandler = {
      postComment: jest.fn(async () => null),
    } as unknown as Context["commentHandler"];
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.OK,
      content: ERROR_MESSAGES.TASK_ASSIGNED,
    });
    expect(context.octokit.rest.pulls.update).not.toHaveBeenCalled();
  });

  it("Should comment on and close a contributor pull-request when no linked issue is found", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const repoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    const context = await createPullRequestEventContext(issue, sender);
    const { commentMock, updateMock } = setPullRequestOctokit(context, { nodes: null });
    const message = ERROR_MESSAGES.INVALID_PULL_REQUEST_LINK.replace("{{user}}", userLogin);

    await mockRepoOctokitModules(repoOctokit);
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: message,
    });
    expect(commentMock).toHaveBeenCalledWith({
      body: expect.any(String),
      issue_number: 1,
      owner: "ubiquity",
      repo: "test-repo",
    });
    expectWarnFormattedPullRequestComment(commentMock, message);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("Should comment on and close a contributor pull-request linked only to closed issues", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const repoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    const context = await createPullRequestEventContext(issue, sender);
    const { commentMock, updateMock } = setPullRequestOctokit(context, {
      nodes: [createClosingIssueNode(repo, { number: issue.number, state: "CLOSED" })],
    });
    const message = ERROR_MESSAGES.INVALID_PULL_REQUEST_LINK.replace("{{user}}", userLogin);

    await mockRepoOctokitModules(repoOctokit);
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: message,
    });
    expect(commentMock).toHaveBeenCalledWith(expect.objectContaining({ body: expect.any(String) }));
    expectWarnFormattedPullRequestComment(commentMock, message);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("Should comment on and close a contributor pull-request linked to another user's issue", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const repoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    const context = await createPullRequestEventContext(issue, sender);
    const { commentMock, updateMock } = setPullRequestOctokit(context, {
      nodes: [createClosingIssueNode(repo, { number: issue.number, assignees: ["someone-else"] })],
    });
    const message = ERROR_MESSAGES.PULL_REQUEST_LINKED_TO_OTHER_ASSIGNEE.replace("{{user}}", userLogin);

    await mockRepoOctokitModules(repoOctokit);
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: message,
    });
    expect(commentMock).toHaveBeenCalledWith(expect.objectContaining({ body: expect.any(String) }));
    expectWarnFormattedPullRequestComment(commentMock, message);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("Should publish an ownership receipt when an open linked issue is already assigned to the author", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const repoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    const context = await createPullRequestEventContext(issue, sender);
    const { commentMock, updateMock } = setPullRequestOctokit(context, {
      nodes: [createClosingIssueNode(repo, { number: issue.number, assignees: [userLogin] })],
    });
    const startTask = jest.fn().mockResolvedValue({ status: HttpStatusCode.OK, content: SUCCESS_MESSAGE });

    await mockRepoOctokitModules(repoOctokit);
    jest.doMock(START_TASK_MODULE_PATH, () => ({
      startTask,
    }));
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.NOT_MODIFIED,
    });
    expect(startTask).not.toHaveBeenCalled();
    expect(commentMock).toHaveBeenCalledTimes(1);
    const [{ body }] = commentMock.mock.calls[0] as [{ body: string }];
    expect(readOwnershipReceipt(body)).toEqual({
      eventName: PULL_REQUEST_EVENT_NAME,
      action: "opened",
      repository: "ubiquity/test-repo",
      pullRequest: 1,
      author: userLogin,
      head: context.payload.pull_request.head,
      base: context.payload.pull_request.base,
      updatedAt: context.payload.pull_request.updated_at,
      role: "contributor",
      reason: "author_assigned",
      result: "leave_open",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("Should keep the pull-request open when at least one valid open linked issue exists", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const successfulRepoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    const context = await createPullRequestEventContext(issue, sender);
    const { commentMock, updateMock } = setPullRequestOctokit(context, {
      nodes: [
        createClosingIssueNode(repo, { number: issue.number + 1, state: "CLOSED" }),
        createClosingIssueNode(repo, { number: issue.number + 2, assignees: ["someone-else"] }),
        createClosingIssueNode(repo, { number: issue.number }),
      ],
    });

    await mockRepoOctokitModules(
      successfulRepoOctokit,
      jest.fn(() => ({
        supabase: {
          user: {
            getWalletByUserId: jest.fn(() => Promise.resolve(null)),
          },
        },
      }))
    );
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.OK,
      content: SUCCESS_MESSAGE,
    });
    expect(commentMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("Should treat a contributor pull-request linked only to another pull-request as invalid", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const repoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    const context = await createPullRequestEventContext(issue, sender);
    const { commentMock, updateMock } = setPullRequestOctokit(context, { nodes: [] });
    const message = ERROR_MESSAGES.INVALID_PULL_REQUEST_LINK.replace("{{user}}", userLogin);

    await mockRepoOctokitModules(repoOctokit);
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: message,
    });
    expect(commentMock).toHaveBeenCalledWith(expect.objectContaining({ body: expect.any(String) }));
    expectWarnFormattedPullRequestComment(commentMock, message);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("Should publish an ownership receipt for a non-contributor edited pull-request with no eligible linked issue", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const adminRepoOctokit = createLinkedIssueRepoOctokit(issue, repo, "admin");
    const context = await createPullRequestEventContext(issue, sender, PULL_REQUEST_EDITED_EVENT_NAME);
    const { commentMock, updateMock } = setPullRequestOctokit(context, { nodes: null });

    await mockRepoOctokitModules(adminRepoOctokit);
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.NOT_MODIFIED,
    });
    expect(commentMock).toHaveBeenCalledTimes(1);
    const [{ body }] = commentMock.mock.calls[0] as [{ body: string }];
    expect(readOwnershipReceipt(body)).toMatchObject({
      eventName: PULL_REQUEST_EDITED_EVENT_NAME,
      action: "edited",
      repository: "ubiquity/test-repo",
      pullRequest: 1,
      author: userLogin,
      head: context.payload.pull_request.head,
      base: context.payload.pull_request.base,
      updatedAt: context.payload.pull_request.updated_at,
      role: "admin",
      reason: "non_contributor_no_eligible_issue",
      result: "leave_open",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("Should refresh one ownership receipt for a later edited snapshot and ignore identical or older redelivery", async () => {
    const fixture = await setupOwnershipReceipt();
    const originalUpdatedAt = fixture.context.payload.pull_request.updated_at;
    const hostileRef = "feature/`-->@someone<&";
    fixture.context.payload.pull_request.head.ref = hostileRef;

    await expect(fixture.run()).resolves.toEqual({ status: HttpStatusCode.NOT_MODIFIED });
    const originalBody = fixture.comments[0].body;
    expect(readOwnershipReceipt(originalBody).head).toEqual({ sha: "a".repeat(40), ref: hostileRef });
    expect(originalBody).not.toContain(hostileRef);
    expect(originalBody).not.toContain("@someone");
    await fixture.run();
    expect(fixture.commentMock).toHaveBeenCalledTimes(1);
    expect(fixture.receiptUpdateMock).not.toHaveBeenCalled();

    fixture.context.payload.pull_request.updated_at = LATER_PULL_REQUEST_UPDATE;
    await fixture.run();
    const refreshedBody = fixture.comments[0].body;
    expect(readOwnershipReceipt(refreshedBody).updatedAt).toBe(LATER_PULL_REQUEST_UPDATE);
    expect(fixture.receiptUpdateMock).toHaveBeenCalledTimes(1);
    expect(fixture.receiptUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 1 }));

    fixture.context.payload.pull_request.updated_at = originalUpdatedAt;
    await fixture.run();
    expect(fixture.comments).toHaveLength(1);
    expect(fixture.comments[0].body).toBe(refreshedBody);
    expect(fixture.commentMock).toHaveBeenCalledTimes(1);
    expect(fixture.receiptUpdateMock).toHaveBeenCalledTimes(1);
    expect(fixture.startTask).not.toHaveBeenCalled();
    expect(fixture.updateMock).not.toHaveBeenCalled();
  });

  it("Should never update an ownership receipt marker copied by another actor or an unrelated App comment", async () => {
    const fixture = await setupOwnershipReceipt();
    const forgedBody = `${OWNERSHIP_RECEIPT_PREFIX}{"updatedAt":"2099-01-01T00:00:00Z"}\n-->`;
    fixture.comments.push(
      { id: 10, body: forgedBody, user: { id: 1, type: "User" }, performed_via_github_app: { id: 1 } },
      { id: 11, body: forgedBody, user: { id: 2, type: "Bot" }, performed_via_github_app: { id: 1 } },
      { id: 12, body: forgedBody, user: { id: 1, type: "Bot" }, performed_via_github_app: { id: 2 } },
      { id: 13, body: "An unrelated App comment", user: { id: 1, type: "Bot" }, performed_via_github_app: { id: 1 } }
    );

    await fixture.run();

    expect(fixture.commentMock).toHaveBeenCalledTimes(1);
    expect(fixture.receiptUpdateMock).not.toHaveBeenCalled();
    expect(fixture.comments.slice(0, 3).map((comment) => comment.body)).toEqual([forgedBody, forgedBody, forgedBody]);
    expect(fixture.comments[3].body).toBe("An unrelated App comment");
    expect(fixture.startTask).not.toHaveBeenCalled();
    expect(fixture.updateMock).not.toHaveBeenCalled();
  });

  it.each(["list", "create", "update"] as const)("Should preserve leave-open and retry an ownership receipt after a %s failure", async (operation) => {
    const fixture = await setupOwnershipReceipt();
    if (operation === "update") {
      await fixture.run();
      fixture.context.payload.pull_request.updated_at = LATER_PULL_REQUEST_UPDATE;
    }
    const warning = jest.spyOn(fixture.context.logger, "warn");
    const error = new Error("Synthetic receipt publication failure");
    if (operation === "list") jest.spyOn(fixture.context.octokit, "paginate").mockRejectedValueOnce(error);
    if (operation === "create") fixture.commentMock.mockRejectedValueOnce(error);
    if (operation === "update") fixture.receiptUpdateMock.mockRejectedValueOnce(error);

    await expect(fixture.run()).resolves.toEqual({ status: HttpStatusCode.NOT_MODIFIED });
    expect(warning).toHaveBeenLastCalledWith("Failed to publish pull request ownership receipt.");
    expect(fixture.startTask).not.toHaveBeenCalled();
    expect(fixture.updateMock).not.toHaveBeenCalled();
    await expect(fixture.run()).resolves.toEqual({ status: HttpStatusCode.NOT_MODIFIED });
    expect(fixture.comments).toHaveLength(1);
    expect(readOwnershipReceipt(fixture.comments[0].body).updatedAt).toBe(fixture.context.payload.pull_request.updated_at);
    expect(fixture.startTask).not.toHaveBeenCalled();
    expect(fixture.updateMock).not.toHaveBeenCalled();
  });

  it("Should preserve leave-open without an ownership receipt when App identity or event time is unavailable", async () => {
    const fixture = await setupOwnershipReceipt();
    fixture.context.env.APP_ID = "invalid";
    await expect(fixture.run()).resolves.toEqual({ status: HttpStatusCode.NOT_MODIFIED });
    fixture.context.env.APP_ID = "1";
    fixture.context.payload.pull_request.updated_at = "invalid";
    await expect(fixture.run()).resolves.toEqual({ status: HttpStatusCode.NOT_MODIFIED });
    expect(fixture.commentMock).not.toHaveBeenCalled();
    expect(fixture.receiptUpdateMock).not.toHaveBeenCalled();
    expect(fixture.startTask).not.toHaveBeenCalled();
    expect(fixture.updateMock).not.toHaveBeenCalled();
  });

  it("Should preserve contributor role-lookup fallback without an ownership receipt on the close path", async () => {
    const fixture = await setupOwnershipReceipt();
    jest.spyOn(fixture.repoOctokit.rest.orgs, "getMembershipForUser").mockRejectedValueOnce(new Error("Synthetic membership failure"));
    jest.spyOn(fixture.repoOctokit.rest.repos, "getCollaboratorPermissionLevel").mockRejectedValueOnce(new Error("Synthetic permission failure"));
    jest.spyOn(fixture.context.octokit.graphql, "paginate").mockResolvedValueOnce({ repository: { pullRequest: { closingIssuesReferences: { nodes: [] } } } });

    await expect(fixture.run()).resolves.toMatchObject({ status: HttpStatusCode.BAD_REQUEST });
    expect(fixture.commentMock).toHaveBeenCalledTimes(1);
    expect(fixture.comments[0].body).not.toContain(OWNERSHIP_RECEIPT_PREFIX);
    expect(fixture.updateMock).toHaveBeenCalledTimes(1);
    expect(fixture.startTask).not.toHaveBeenCalled();
  });

  it("Should still close an invalid pull-request when commenting fails", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const repoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    const context = await createPullRequestEventContext(issue, sender);
    const { updateMock } = setPullRequestOctokit(context, {
      nodes: null,
      commentMock: jest.fn(() => Promise.reject(new Error("comment failure"))),
    });
    const message = ERROR_MESSAGES.INVALID_PULL_REQUEST_LINK.replace("{{user}}", userLogin);

    await mockRepoOctokitModules(repoOctokit);
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: message,
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("Should return the invalid result even when closing the pull-request fails", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const repoOctokit = createLinkedIssueRepoOctokit(issue, repo);
    const context = await createPullRequestEventContext(issue, sender);
    const { commentMock, updateMock } = setPullRequestOctokit(context, {
      nodes: null,
      updateMock: jest.fn(() => Promise.reject(new Error(CLOSE_FAILURE))),
    });
    const message = ERROR_MESSAGES.INVALID_PULL_REQUEST_LINK.replace("{{user}}", userLogin);

    await mockRepoOctokitModules(repoOctokit);
    const { startStopTask } = await import("../src/plugin");

    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: message,
    });
    expect(commentMock).toHaveBeenCalledWith(expect.objectContaining({ body: expect.any(String) }));
    expectWarnFormattedPullRequestComment(commentMock, message);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
