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
    },
    issues: [],
  });
}

describe("Collaborator tests", () => {
  beforeEach(async () => {
    drop(db);
    jest.clearAllMocks();
    jest.resetModules();
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
        diff: "```diff\n! Only collaborators can be assigned to this issue.\n```",
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
    const { startStopTask } = await import("../src/plugin");
    await startStopTask(context);
    // Make sure the author is the one who starts and not the sender who modified the comment
    expect(start).toHaveBeenCalledWith(expect.anything(), expect.anything(), { id: 1, login: userLogin }, []);
    start.mockReset();
  });
  it("Should properly update the close status of a linked pull-request", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    issue.labels = [];
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "") as Context<"pull_request.opened">;
    context.eventName = "pull_request.opened";
    context.payload.pull_request = {
      html_url: "https://github.com/ubiquity-os-marketplace/command-start-stop",
      number: 1,
      user: {
        id: 1,
        login: userLogin,
      },
    } as unknown as Context<"pull_request.edited">["payload"]["pull_request"];
    context.octokit = {
      rest: {
        pulls: {
          update: jest.fn(),
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
                      labels: {
                        nodes: [{ name: "Time: <1 Hour" }],
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
    const { startStopTask } = await import("../src/plugin");
    await expect(startStopTask(context)).rejects.toMatchObject({
      logMessage: {
        raw: expect.stringContaining("No price label is set to calculate the duration"),
      },
    });
    context.octokit = {
      ...context.octokit,
      //@ts-expect-error partial mock of the endpoint
      paginate: jest.fn(() => []),
      rest: {
        ...context.octokit.rest,
        orgs: {
          //@ts-expect-error partial mock of the endpoint
          getMembershipForUser: jest.fn(() => ({ data: { role: "member" } })),
        },
      },
    };
    await expect(startStopTask(context)).rejects.toMatchObject({
      logMessage: {
        raw: expect.stringContaining("This task does not reflect a business priority at the moment"),
      },
    });
  });
});
