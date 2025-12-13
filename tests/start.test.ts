import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import dotenv from "dotenv";
import { Context } from "../src/types/context";
import { db } from "./__mocks__/db";
import issueTemplate from "./__mocks__/issue-template";
import { server } from "./__mocks__/node";
import { createContext } from "./utils";

dotenv.config();

const userLogin = "ubiquity-os-author";
const TEST_USER_ID = 3;

type Issue = Context<"issue_comment.created">["payload"]["issue"];
type PayloadSender = Context["payload"]["sender"];

const commandStartStop = "command-start-stop";
const ubiquityOsMarketplace = "ubiquity-os-marketplace";

const modulePath = "../src/handlers/start-task";
const supabaseModulePath = "@supabase/supabase-js";
const adaptersModulePath = "../src/adapters";

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => server.close());

async function setupTests() {
  db.users.create({
    id: 1,
    login: "user1",
    role: "contributor",
    created_at: new Date("2020-01-01T00:00:00Z").toISOString(),
    xp: 5000,
    wallet: null,
  });
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
}

describe("Collaborator tests", () => {
  beforeEach(async () => {
    drop(db);
    jest.clearAllMocks();
    jest.resetModules();
    jest.resetAllMocks();
    await setupTests();
  });

  it("should assign the author of the pull-request and not the sender of the edit", async () => {
    db.users.create({
      id: TEST_USER_ID,
      login: "ubiquity-os-sender",
      role: "admin",
      created_at: new Date("2018-01-01T00:00:00Z").toISOString(),
      xp: 8000,
      wallet: null,
    });
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: TEST_USER_ID } } }) as unknown as PayloadSender;
    const context = (await createContext(issue, sender, "")) as Context<"pull_request.edited">;
    context.eventName = "pull_request.edited";
    context.payload.pull_request = {
      html_url: "https://github.com/ubiquity-os-marketplace/command-start-stop",
      number: 1,
      user: {
        id: 1,
        login: userLogin,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.octokit = {
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
                      labels: {
                        nodes: [{ name: "Time: <1 Hour" }],
                      },
                      repository: {
                        id: 1,
                        name: commandStartStop,
                        owner: {
                          id: 1,
                          login: ubiquityOsMarketplace,
                        },
                      },
                    },
                  ],
                },
              },
            },
          })
        ),
      },
    } as unknown as Context<"pull_request.edited">["octokit"];

    jest.mock(supabaseModulePath, () => ({
      createClient: jest.fn(),
    }));
    jest.mock(adaptersModulePath, () => ({
      createAdapters: jest.fn(),
    }));
    const startTask = jest.fn();
    jest.mock(modulePath, () => ({
      startTask,
    }));

    // Mock createRepoOctokit to return an octokit instance with the required methods
    const mockRepoOctokit = {
      rest: {
        apps: {
          getRepoInstallation: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
        },
        issues: {
          get: jest.fn(() => Promise.resolve({ data: issue })),
        },
        repos: {
          get: jest.fn(() =>
            Promise.resolve({ data: { id: 1, name: commandStartStop, owner: { id: 1, login: ubiquityOsMarketplace, type: "Organization" } } })
          ),
        },
        orgs: {
          get: jest.fn(() => Promise.resolve({ data: { id: 1, login: ubiquityOsMarketplace } })),
        },
      },
    };

    // Import the octokit helpers module and spy on createRepoOctokit
    const octokitHelpers = await import("../src/handlers/start/api/helpers/octokit");
    jest.spyOn(octokitHelpers, "createRepoOctokit").mockResolvedValue(mockRepoOctokit as never);

    const { startStopTask } = await import("../src/plugin");
    await startStopTask(context);
    // Make sure the author is the one who starts and not the sender who modified the comment
    expect(startTask).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          pull_request: expect.objectContaining({
            user: expect.objectContaining({ login: userLogin }),
          }),
        }),
      })
    );
    startTask.mockClear();
  });

  it("should successfully assign if the PR and linked issue are in different organizations", async () => {
    db.users.create({
      id: TEST_USER_ID,
      login: "ubiquity-os-sender",
      role: "admin",
      created_at: new Date("2018-01-01T00:00:00Z").toISOString(),
      xp: 8000,
      wallet: null,
    });
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: TEST_USER_ID } } }) as unknown as PayloadSender;
    const repository = db.repo.findFirst({ where: { id: { equals: 1 } } });

    const context = (await createContext(issue, sender, "")) as Context<"pull_request.edited">;
    context.eventName = "pull_request.edited";
    context.payload.pull_request = {
      html_url: "https://github.com/ubiquity-os-marketplace/command-start-stop",
      number: 2,
      user: {
        id: 1,
        login: "whilefoo",
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.payload.repository = {
      id: 2,
      name: commandStartStop,
      owner: {
        login: ubiquityOsMarketplace,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["repository"];
    context.octokit = {
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
                      labels: {
                        nodes: [{ name: "Time: <1 Hour" }],
                      },
                      repository: repository,
                    },
                  ],
                },
              },
            },
          })
        ),
      },
    } as unknown as Context<"pull_request.edited">["octokit"];

    jest.mock(supabaseModulePath, () => ({
      createClient: jest.fn(),
    }));
    jest.mock(adaptersModulePath, () => ({
      createAdapters: jest.fn(),
    }));
    const startTask = jest.fn();
    jest.mock(modulePath, () => ({
      startTask,
    }));
    jest.mock("@ubiquity-os/plugin-sdk/octokit", () => ({
      customOctokit: jest.fn().mockReturnValue({
        rest: {
          apps: {
            getRepoInstallation: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
          },
          issues: {
            get: jest.fn(() => Promise.resolve({ data: issue })),
          },
          repos: {
            get: jest.fn(() => Promise.resolve({ data: repository })),
          },
          orgs: {
            get: jest.fn(() => Promise.resolve({ data: repository?.owner })),
          },
        },
      }),
    }));
    const { startStopTask } = await import("../src/plugin");
    await startStopTask(context);
    // expect the task to be assigned to whilefoo in the new organization
    expect(startTask).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          pull_request: expect.objectContaining({
            user: expect.objectContaining({ login: "whilefoo" }),
            html_url: expect.stringContaining(ubiquityOsMarketplace),
          }),
        }),
      })
    );

    startTask.mockReset();
  });
});
