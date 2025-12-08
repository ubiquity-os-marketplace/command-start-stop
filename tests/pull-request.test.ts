import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Repository } from "@octokit/graphql-schema";
import dotenv from "dotenv";
import { ERROR_MESSAGES } from "../src/handlers/start/helpers/error-messages";
import { Context } from "../src/types/index";
import { HttpStatusCode } from "../src/types/result-types";
import { db } from "./__mocks__/db";
import issueTemplate from "./__mocks__/issue-template";
import { server } from "./__mocks__/node";
import { createContext } from "./utils";

dotenv.config();

const userLogin = "user2";
const ONE_HOUR_TIME_LABEL = "Time: <1 Hour";

type Issue = Context<"issue_comment.created">["payload"]["issue"];
type PayloadSender = Context["payload"]["sender"];

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

describe("Pull-request tests", () => {
  beforeEach(async () => {
    drop(db);
    jest.clearAllMocks();
    jest.resetModules();
    jest.resetAllMocks();
    await setupTests();
  });

  it("Should properly handle a pull-request without a price label", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Repository;
    issue.labels = [];
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;

    const context = (await createContext(issue, sender, "")) as Context<"pull_request.opened">;
    context.eventName = "pull_request.opened";
    context.payload.pull_request = {
      html_url: "https://github.com/ubiquity-os-marketplace/command-start-stop",
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
    jest.mock("@supabase/supabase-js", () => ({
      createClient: jest.fn(),
    }));
    jest.mock("../src/adapters", () => ({
      createAdapters: jest.fn(),
    }));
    jest.mock("@ubiquity-os/plugin-sdk/octokit", () => ({
      customOctokit: jest.fn().mockReturnValue({
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
      }),
    }));
    jest.mock("../src/handlers/start/api/helpers/octokit", () => {
      const mockRepoOctokit = {
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
      };
      return {
        createUserOctokit: jest.fn(() => mockRepoOctokit),
        createAppOctokit: jest.fn(() => mockRepoOctokit),
        createRepoOctokit: jest.fn(() => Promise.resolve(mockRepoOctokit)),
      };
    });
    context.commentHandler = {
      postComment: jest.fn(async () => null),
    } as unknown as Context["commentHandler"];
    const { startStopTask } = await import("../src/plugin");
    const result = await startStopTask(context);

    expect(result).toMatchObject({
      status: HttpStatusCode.BAD_REQUEST,
      content: expect.stringContaining("You may not start the task because the issue requires a price label. Please ask a maintainer to add pricing."),
    });
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
    context.eventName = "pull_request.opened";
    context.payload.pull_request = {
      html_url: "https://github.com/ubiquity-os-marketplace/command-start-stop",
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
    jest.mock("@supabase/supabase-js", () => ({
      createClient: jest.fn(),
    }));
    jest.mock("../src/adapters", () => ({
      createAdapters: jest.fn(() => ({
        supabase: {
          user: {
            getWalletByUserId: jest.fn(() => Promise.resolve(null)),
          },
        },
      })),
    }));
    const mockRepoOctokit = {
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
        },
        search: {
          issuesAndPullRequests: jest.fn(() => Promise.resolve({ data: { items: [] } })),
        },
        repos: {
          get: jest.fn(() => Promise.resolve({ data: repo })),
          getCollaboratorPermissionLevel: jest.fn(() => Promise.resolve({ data: { role_name: "contributor" } })),
        },
        orgs: {
          get: jest.fn(() => Promise.resolve({ data: repo?.owner })),
          getMembershipForUser: jest.fn(() => ({ data: { role: "contributor" } })),
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
    };
    jest.mock("@ubiquity-os/plugin-sdk/octokit", () => ({
      customOctokit: jest.fn().mockReturnValue(mockRepoOctokit),
    }));
    jest.mock("../src/handlers/start/api/helpers/octokit", () => ({
      createUserOctokit: jest.fn(() => Promise.resolve(mockRepoOctokit)),
      createAppOctokit: jest.fn(() => Promise.resolve(mockRepoOctokit)),
      createRepoOctokit: jest.fn(() => Promise.resolve(mockRepoOctokit)),
    }));
    context.commentHandler = {
      postComment: jest.fn(async () => null),
    } as unknown as Context["commentHandler"];
    const { startStopTask } = await import("../src/plugin");
    expect.assertions(1);

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
  });
});
