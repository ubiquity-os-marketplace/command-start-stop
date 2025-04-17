import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import dotenv from "dotenv";
import { Context } from "../src/types";
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

const modulePath = "../src/handlers/shared/start";
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
    });
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: TEST_USER_ID } } }) as unknown as PayloadSender;
    const context = createContext(issue, sender, "") as Context<"pull_request.edited">;
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

    jest.unstable_mockModule(supabaseModulePath, () => ({
      createClient: jest.fn(),
    }));
    jest.unstable_mockModule(adaptersModulePath, () => ({
      createAdapters: jest.fn(),
    }));
    const start = jest.fn();
    jest.unstable_mockModule(modulePath, () => ({
      start,
    }));
    jest.unstable_mockModule("@ubiquity-os/plugin-sdk/octokit", () => ({
      customOctokit: jest.fn().mockReturnValue({
        rest: {
          apps: {
            getRepoInstallation: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
          },
          issues: {
            get: jest.fn(() => Promise.resolve({ data: issue })),
          },
          repos: {
            get: jest.fn(() => Promise.resolve({ data: { id: 1, name: commandStartStop, owner: { id: 1, login: ubiquityOsMarketplace } } })),
          },
          orgs: {
            get: jest.fn(() => Promise.resolve({ data: { id: 1, login: ubiquityOsMarketplace } })),
          },
        },
      }),
    }));
    const { startStopTask } = await import("../src/plugin");
    await startStopTask(context);
    // Make sure the author is the one who starts and not the sender who modified the comment
    expect(start).toHaveBeenCalledWith(expect.anything(), expect.anything(), { id: 1, login: userLogin }, []);
    start.mockClear();
  });

  it("should block bounty tasks when price limit is negative", async () => {
    jest.unstable_mockModule(supabaseModulePath, () => ({
      createClient: jest.fn(),
    }));
    jest.unstable_mockModule(adaptersModulePath, () => ({
      createAdapters: jest.fn(),
    }));
    db.users.create({
      id: TEST_USER_ID,
      login: "test-user",
      role: "contributor",
    });
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    issue.labels = [
      {
        name: "Price: 100",
        color: "000000",
        default: false,
        description: null,
        id: 1,
        node_id: "1",
        url: "https://api.github.com/labels/1",
      },
      {
        name: "Priority: 1 (Normal)",
        color: "000000",
        default: false,
        description: null,
        id: 2,
        node_id: "2",
        url: "https://api.github.com/labels/2",
      },
    ];
    const sender = db.users.findFirst({ where: { id: { equals: TEST_USER_ID } } }) as unknown as PayloadSender;
    const context = { ...createContext(issue, sender, "/start"), issue: {} } as Context<"issue_comment.created">;
    context.config.taskAccessControl.usdPriceMax = {
      collaborator: -1,
      contributor: -1,
    };
    const { startStopTask } = await import("../src/plugin");
    await expect(startStopTask(context)).rejects.toMatchObject({
      logMessage: { raw: "@test-user, we are currently prioritizing core operations. Tasks cannot be started by contributors at this time." },
    });
  });

  it("should successfully assign if the PR and linked issue are in different organizations", async () => {
    db.users.create({
      id: TEST_USER_ID,
      login: "ubiquity-os-sender",
      role: "admin",
    });
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: TEST_USER_ID } } }) as unknown as PayloadSender;
    const repository = db.repo.findFirst({ where: { id: { equals: 1 } } });

    const context = createContext(issue, sender, "") as Context<"pull_request.edited">;
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
        login: "ubiquity-os-marketplace",
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

    jest.unstable_mockModule(supabaseModulePath, () => ({
      createClient: jest.fn(),
    }));
    jest.unstable_mockModule(adaptersModulePath, () => ({
      createAdapters: jest.fn(),
    }));
    const start = jest.fn();
    jest.unstable_mockModule(modulePath, () => ({
      start,
    }));
    jest.unstable_mockModule("@ubiquity-os/plugin-sdk/octokit", () => ({
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
    expect(start.mock.calls[0][0]).toMatchObject({ payload: { issue, repository, organization: repository?.owner } });
    expect(start.mock.calls[0][1]).toMatchObject({ id: 1 });
    expect(start.mock.calls[0][2]).toMatchObject({ id: 1, login: "whilefoo" });
    expect(start.mock.calls[0][3]).toEqual([]);
    start.mockReset();
  });
});
