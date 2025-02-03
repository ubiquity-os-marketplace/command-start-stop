import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import dotenv from "dotenv";
import { createAdapters } from "../src/adapters";
import { start } from "../src/handlers/shared/start";
import { Context } from "../src/types";
import { db } from "./__mocks__/db";
import issueTemplate from "./__mocks__/issue-template";
import { server } from "./__mocks__/node";
import { createContext, getSupabase } from "./main.test";

dotenv.config();

const userLogin = "ubiquity-os-author";

type Issue = Context<"issue_comment.created">["payload"]["issue"];
type PayloadSender = Context["payload"]["sender"];

const commandStartStop = "command-start-stop";
const ubiquityOsMarketplace = "ubiquity-os-marketplace";

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

  it("Should return error if user trying to assign is not a collaborator", async () => {
    db.users.create({
      id: 3,
      login: "user1",
      role: "contributor",
    });
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 3 } } }) as unknown as PayloadSender;
    const context = createContext(issue, sender, "/start");
    context.adapters = createAdapters(getSupabase(), context);
    await expect(start(context, issue, sender, [])).rejects.toMatchObject({
      logMessage: {
        diff: expect.stringContaining("Only collaborators can be assigned to this issue"),
        level: "error",
        raw: "Only collaborators can be assigned to this issue.",
        type: "error",
      },
    });
  });

  it("should assign the author of the pull-request and not the sender of the edit", async () => {
    db.users.create({
      id: 3,
      login: "ubiquity-os-sender",
      role: "admin",
    });
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 3 } } }) as unknown as PayloadSender;
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

    jest.unstable_mockModule("@supabase/supabase-js", () => ({
      createClient: jest.fn(),
    }));
    jest.unstable_mockModule("../src/adapters", () => ({
      createAdapters: jest.fn(),
    }));
    const start = jest.fn();
    jest.unstable_mockModule("../src/handlers/shared/start", () => ({
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

  it("should successfully assign if the PR and linked issue are in different organizations", async () => {
    db.users.create({
      id: 3,
      login: "ubiquity-os-sender",
      role: "admin",
    });
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 3 } } }) as unknown as PayloadSender;
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

    jest.unstable_mockModule("@supabase/supabase-js", () => ({
      createClient: jest.fn(),
    }));
    jest.unstable_mockModule("../src/adapters", () => ({
      createAdapters: jest.fn(),
    }));
    const start = jest.fn();
    jest.unstable_mockModule("../src/handlers/shared/start", () => ({
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
