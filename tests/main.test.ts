import { drop } from "@mswjs/data";
import { Context, SupportedEventsU } from "../src/types";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import usersGet from "./__mocks__/users-get.json";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach } from "@jest/globals";
import { userStartStop } from "../src/handlers/user-start-stop";
import issueTemplate from "./__mocks__/issue-template";
import { createAdapters } from "../src/adapters";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

type Issue = Context["payload"]["issue"];
type Sender = Context["payload"]["sender"];

const octokit = jest.requireActual("@octokit/rest");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  throw new Error("Supabase URL and Key are required");
}

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  drop(db);
  server.resetHandlers();
});
afterAll(() => server.close());

describe("User start/stop", () => {
  beforeEach(async () => {
    await setupTests();
  });

  test("User can start an issue", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender);

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    const { output } = await userStartStop(context as unknown as Context);

    expect(output).toEqual("Task assigned successfully");
  });

  test("User can stop an issue", async () => {
    // using the second issue
    const issue = db.issue.findFirst({ where: { id: { equals: 2 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as Sender;

    const context = createContext(issue, sender, "/stop");

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    const { output } = await userStartStop(context as unknown as Context);

    expect(output).toEqual("Task unassigned successfully");
  });

  test("User can't stop an issue they're not assigned to", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    // using the second issue
    const issue = db.issue.findFirst({ where: { id: { equals: 2 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender, "/stop");

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    await userStartStop(context as unknown as Context);

    expect(errorSpy).toHaveBeenCalledWith("You are not assigned to this task");
  });

  test("User can't start an issue that's already assigned", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 2 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender, "/start");

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    const err = "Issue is already assigned";

    try {
      await userStartStop(context as unknown as Context);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual(err);
      }
    }
  });

  test("User can't start an issue without a price label", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 3 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender);

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    const err = "No price label is set to calculate the duration";

    try {
      await userStartStop(context as unknown as Context);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual(err);
      }
    }
  });

  test("User can't start an issue without a wallet address", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender);

    context.adapters = createAdapters(getSupabase(false), context as unknown as Context);

    try {
      await userStartStop(context as unknown as Context);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual("No wallet address found");
      }
    }
  });

  test("User can't start an issue that's closed", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 4 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender);

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    try {
      await userStartStop(context as unknown as Context);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual("Issue is closed");
      }
    }
  });

  test("User can't start if command is disabled", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender, "/start", true);

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    try {
      await userStartStop(context as unknown as Context);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual("The '/start' command is disabled for this repository.");
      }
    }
  });

  test("User can't stop if command is disabled", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender, "/stop", true);

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    try {
      await userStartStop(context as unknown as Context);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual("The '/stop' command is disabled for this repository.");
      }
    }
  });

  test("User can't start an issue that's a parent issue", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender, "/start");

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    try {
      await userStartStop(context as unknown as Context);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual("Issue is a parent issue");
      }
    }
  });

  test("User can't start another issue if they have reached the max limit", async () => {
    // getAvailableOpenedPullRequests()
    jest.mock("../src/utils/issue", () => ({
      getAvailableOpenedPullRequests: jest.fn().mockResolvedValue([
        {
          number: 1,
          reviews: [
            {
              state: "APPROVED",
            },
          ],
        },
        {
          number: 2,
          reviews: [
            {
              state: "APPROVED",
            },
          ],
        },
        {
          number: 3,
          reviews: [
            {
              state: "APPROVED",
            },
          ],
        },
      ]),
    }));

    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender);

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    try {
      await userStartStop(context as unknown as Context);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual("Too many assigned issues, you have reached your max limit of 3 issues.");
      }
    }
  });
});

async function setupTests() {
  for (const item of usersGet) {
    db.users.create(item);
  }

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

  db.issue.create({
    ...issueTemplate,
  });

  db.issue.create({
    ...issueTemplate,
    id: 2,
    node_id: "MDU6SXNzdWUy",
    title: "Second issue",
    number: 2,
    body: "Second issue body",
    assignee: {
      id: 2,
      login: "user2",
    },
    assignees: [
      {
        id: 2,
        login: "user2",
      },
    ],
    owner: "ubiquity",
  });

  db.issue.create({
    ...issueTemplate,
    id: 3,
    node_id: "MDU6SXNzdWUy",
    title: "Third issue",
    number: 3,
    labels: [],
    body: "Third issue body",
    owner: "ubiquity",
  });

  db.issue.create({
    ...issueTemplate,
    id: 4,
    node_id: "MDU6SXNzdWUy",
    title: "Fourth issue",
    number: 4,
    body: "Fourth issue body",
    owner: "ubiquity",
    state: "CLOSED",
  });

  db.issue.create({
    ...issueTemplate,
    id: 5,
    node_id: "MDU6SXNzdWUy",
    title: "Fifth issue",
    number: 5,
    body: "- [x] #1\n- [ ] #2",
    owner: "ubiquity",
  });

  db.pull.create({
    id: 1,
    html_url: "",
    number: 1,
    author: {
      id: 2,
      name: "user2",
    },
    body: "Pull request body",
    owner: "user2",
    repo: "test-repo",
  });

  db.review.create({
    id: 1,
    body: "Review body",
    commit_id: "123",
    html_url: "",
    pull_request_url: "",
    state: "APPROVED",
    submitted_at: new Date().toISOString(),
    user: {
      id: 1,
      name: "ubiquity",
    },
    pull_number: 1,
  });

  db.event.create({
    id: 1,
    actor: {
      id: 2,
      name: "user2",
    },
    commit_id: "123",
    commit_url: "",
    created_at: new Date().toISOString(),
    event: "cross-referenced",
    issue_number: 1,
    owner: "ubiquity",
    repo: "test-repo",
  });

  db.event.create({
    id: 2,
    actor: {
      id: 1,
      name: "ubiquity",
    },
    commit_id: "123",
    commit_url: "",
    created_at: new Date().toISOString(),
    event: "cross-referenced",
    issue_number: 2,
    owner: "ubiquity",
    repo: "test-repo",
  });
}

function createContext(issue: Record<string, unknown>, sender: Record<string, unknown>, body = "/start", disabled = false) {
  return {
    adapters: {} as ReturnType<typeof createAdapters>,
    payload: {
      issue: issue as unknown as Context["payload"]["issue"],
      sender: sender as unknown as Context["payload"]["sender"],
      repository: db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Context["payload"]["repository"],
      comment: { body } as unknown as Context["payload"]["comment"],
      action: "created" as string,
      installation: { id: 1 } as unknown as Context["payload"]["installation"],
      organization: { login: "ubiquity" } as unknown as Context["payload"]["organization"],
    },
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
    config: {
      disabledCommands: disabled ? ["start"] : [],
      timers: {
        reviewDelayTolerance: 86000,
        taskStaleTimeoutDuration: 2580000,
      },
      miscellaneous: {
        maxConcurrentTasks: 3,
      },
      labels: {
        time: ["Time: 1h", "Time: <4 hours", "Time: <1 Day", "Time: <3 Days", "Time: <1 Week"],
        priority: ["Priority: 1 (Normal)", "Priority: 2 (High)", "Priority: 3 (Critical)"],
      },
    },
    octokit: new octokit.Octokit(),
    eventName: "issue_comment.created" as SupportedEventsU,
    env: {
      GITHUB_TOKEN: "token",
      SUPABASE_KEY: key,
      SUPABASE_URL: url,
    },
  };
}

function getSupabase(withData = true) {
  const mockedTable = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: withData
            ? {
                id: 1,
                wallets: {
                  address: "0x123",
                },
              }
            : {
                id: 1,
                wallets: {
                  address: undefined,
                },
              },
        }),
      }),
    }),
  };

  const mockedSupabase = {
    from: jest.fn().mockReturnValue(mockedTable),
  };

  return mockedSupabase as unknown as ReturnType<typeof createClient>;
}