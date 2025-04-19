import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { drop } from "@mswjs/data";
import { TransformDecodeError, Value } from "@sinclair/typebox/value";
import { createClient } from "@supabase/supabase-js";
import { cleanLogString, LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import dotenv from "dotenv";
import { createAdapters } from "../src/adapters";
import { HttpStatusCode } from "../src/handlers/result-types";
import { userStartStop, userUnassigned } from "../src/handlers/user-start-stop";
import { Context, Env, envSchema, Sender } from "../src/types";
import { db } from "./__mocks__/db";
import issueTemplate from "./__mocks__/issue-template";
import { server } from "./__mocks__/node";
import usersGet from "./__mocks__/users-get.json";
import { createContext, MAX_CONCURRENT_DEFAULTS } from "./utils";

dotenv.config();

type Issue = Context<"issue_comment.created">["payload"]["issue"];
type PayloadSender = Context["payload"]["sender"];

const TEST_REPO = "ubiquity/test-repo";
const PRIORITY_ONE = { name: "Priority: 1 (Normal)", allowedRoles: ["collaborator", "contributor"] };
const priority3LabelName = "Priority: 3 (High)";
const priority4LabelName = "Priority: 4 (Urgent)";
const priority5LabelName = "Priority: 5 (Emergency)";

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  drop(db);
  server.resetHandlers();
});
afterAll(() => server.close());

const SUCCESS_MESSAGE = "Task assigned successfully";

describe("User start/stop", () => {
  beforeEach(async () => {
    drop(db);
    jest.clearAllMocks();
    jest.resetModules();
    await setupTests();
  });

  test("Collaborator can assign with string Infinity", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 3 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start", "Infinity") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);
    const { content } = await userStartStop(context);

    expect(content).toEqual(SUCCESS_MESSAGE);
  });

  test("User can't start a task priced more than their assigned usdPriceMax", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 8 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 3 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);
    await expect(userStartStop(context)).rejects.toMatchObject({
      logMessage: {
        raw: "While we appreciate your enthusiasm @user3, the price of this task exceeds your allowed limit. Please choose a task with a price of $10000 or less.",
      },
      metadata: {
        userRole: "collaborator",
        price: 15000,
        userAllowedMaxPrice: 10000,
        issueNumber: 8,
      },
    });
  });

  test("User can start an issue", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender) as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    const { content } = await userStartStop(context);

    expect(content).toEqual(SUCCESS_MESSAGE);
  });

  test("User can start an issue with trimmed command", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "\n\n/start\n") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    const { content } = await userStartStop(context);

    expect(content).toEqual(SUCCESS_MESSAGE);
  });

  test("User can start an issue with teammates", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Sender;

    const context = createContext(issue, sender, "/start @user3") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    const { content } = await userStartStop(context);

    expect(content).toEqual(SUCCESS_MESSAGE);

    const issue2 = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    expect(issue2.assignees).toHaveLength(2);
    expect(issue2.assignees).toEqual(expect.arrayContaining(["ubiquity", "user3"]));
  });

  test("User can stop an issue", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 2 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/stop") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    const { content } = await userStartStop(context);

    expect(content).toEqual("Task unassigned successfully");
  });

  test("Stopping an issue should close the author's linked PR", async () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    const issue = db.issue.findFirst({ where: { id: { equals: 2 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const context = createContext(issue, sender, "/stop") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    const { content } = await userStartStop(context);

    expect(content).toEqual("Task unassigned successfully");
    const logs = infoSpy.mock.calls.flat();
    expect(logs[0]).toMatch(/Opened prs/);
    expect(cleanLogString(logs[3])).toMatch(cleanLogString("›Closinglinkedpull-request."));
  });

  test("Author's manual unassign should close linked issue", async () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    const issue = db.issue.findFirst({ where: { id: { equals: 2 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;
    const context = createContext(issue, sender, "") as Context<"issues.unassigned">;

    context.adapters = createAdapters(getSupabase(), context);

    const { content } = await userUnassigned(context);

    expect(content).toEqual("Linked pull-requests closed.");
    const logs = infoSpy.mock.calls.flat();
    expect(logs[0]).toMatch(/Opened prs/);
    expect(cleanLogString(logs[3])).toMatch(cleanLogString("›Closinglinkedpull-request."));
  });

  test("User can't stop an issue they're not assigned to", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 2 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/stop") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    await expect(userStartStop(context)).rejects.toMatchObject({ logMessage: { raw: "You are not assigned to this task" } });
  });

  test("User can't stop an issue without assignees", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 6 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/stop") as Context<"issue_comment.created">;
    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    await expect(userStartStop(context)).rejects.toMatchObject({ logMessage: { raw: "You are not assigned to this task" } });
  });

  test("User can't start an issue that's already assigned", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 2 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    await expect(userStartStop(context)).rejects.toMatchObject({
      logMessage: { raw: "This issue is already assigned. Please choose another unassigned task." },
    });
  });

  test("User can't start an issue without a price label", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 3 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender) as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    try {
      await userStartStop(context);
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      const aggregateError = error as AggregateError;
      const errorMessages = aggregateError.errors.map((error) => error.message);
      expect(errorMessages).toEqual(expect.arrayContaining(["No price label is set to calculate the duration"]));
    }
  });

  test("User can't start an issue without a wallet address", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start", "Infinity", true) as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(false), context);
    await expect(userStartStop(context)).rejects.toBeInstanceOf(LogReturn);
  });

  test("User can't start an issue that's closed", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 4 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender) as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    await expect(userStartStop(context)).rejects.toMatchObject({ logMessage: { raw: "This issue is closed, please choose another." } });
  });

  test("User can't start an issue that's a parent issue", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 5 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start") as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    await expect(userStartStop(context)).rejects.toMatchObject({
      logMessage: { raw: "Please select a child issue from the specification checklist to work on. The '/start' command is disabled on parent issues." },
    });
  });

  test("should set maxLimits to 6 if the user is a member", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 5 } } }) as unknown as Sender;

    const memberLimit = MAX_CONCURRENT_DEFAULTS.collaborator;

    createIssuesForMaxAssignment(memberLimit + 4, sender.id);
    const context = createContext(issue, sender) as unknown as Context;

    context.adapters = createAdapters(getSupabase(), context as unknown as Context);

    const { content, status } = await userStartStop(context);
    expect(content).toEqual("You have reached your max task limit. Please close out some tasks before assigning new ones.");
    expect(status).toEqual(HttpStatusCode.NOT_MODIFIED);

    expect(memberLimit).toEqual(6);
  });

  test("User can't start an issue if they have previously been unassigned by an admin", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 6 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start") as Context<"issue_comment.created">;
    context.adapters = createAdapters(getSupabase(), context);

    await expect(userStartStop(context)).rejects.toMatchObject({
      logMessage: { raw: "user2 you were previously unassigned from this task. You cannot be reassigned." },
    });
  });

  test("Should throw if no BOT_USER_ID is set", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start", undefined);

    const env = { ...context.env };
    Reflect.deleteProperty(env, "BOT_USER_ID");

    const errors = [...Value.Errors(envSchema, env)];
    const errorDetails: string[] = [];
    for (const error of errors) {
      errorDetails.push(`${error.path}: ${error.message}`);
    }

    expect(errorDetails).toContain("/BOT_USER_ID: Expected union value");
  });

  test("Should throw if BOT_USER_ID is not a number", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start", "Infinity");
    const env: Env = { ...context.env, BOT_USER_ID: "Not a number" as unknown as number, APP_ID: "1" };

    let err: unknown = null;
    try {
      Value.Decode(envSchema, env);
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeNull();
    expect(err).toBeInstanceOf(TransformDecodeError);
    if (err instanceof TransformDecodeError) {
      expect(err.message).toContain("Invalid BOT_USER_ID");
    }
  });

  test("Should not allow a user to start if no requiredLabelToStart exists", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 7 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 3 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start", "Infinity", false, [
      { name: priority3LabelName, allowedRoles: ["collaborator", "contributor"] },
      { name: priority4LabelName, allowedRoles: ["collaborator", "contributor"] },
      { name: priority5LabelName, allowedRoles: ["collaborator", "contributor"] },
    ]) as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    try {
      await userStartStop(context);
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      const aggregateError = error as AggregateError;
      const errorMessages = aggregateError.errors.map((error) => error.message);
      expect(errorMessages).toEqual(
        expect.arrayContaining([
          "This task does not reflect a business priority at the moment.\nYou may start tasks with one of the following labels: `Priority: 3 (High)`, `Priority: 4 (Urgent)`, `Priority: 5 (Emergency)`",
        ])
      );
    }
  });

  test("Should not allow a user to start if the user role is not listed", async () => {
    const issue = db.issue.findFirst({ where: { id: { equals: 7 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 2 } } }) as unknown as PayloadSender;

    const context = createContext(issue, sender, "/start", "Infinity", false, [
      { name: "Priority: 1 (Normal)", allowedRoles: ["collaborator"] },
      { name: "Priority: 2 (Medium)", allowedRoles: ["collaborator"] },
      { name: priority3LabelName, allowedRoles: ["collaborator"] },
      { name: priority4LabelName, allowedRoles: ["collaborator"] },
      { name: priority5LabelName, allowedRoles: ["collaborator"] },
    ]) as Context<"issue_comment.created">;

    context.adapters = createAdapters(getSupabase(), context);

    try {
      await userStartStop(context);
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      const aggregateError = error as AggregateError;
      const errorMessages = aggregateError.errors.map((error) => error.message);
      expect(errorMessages).toEqual(expect.arrayContaining(["You must be a core team member, or an administrator to start this task"]));
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
    labels: [
      {
        name: PRIORITY_ONE.name,
      },
    ],
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
    state: "closed",
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

  db.issue.create({
    ...issueTemplate,
    id: 6,
    node_id: "MDU6SXNzdWUg",
    title: "Sixth issue",
    number: 5,
    body: "Sixth issue body",
    owner: "ubiquity",
    assignees: [],
  });

  db.issue.create({
    ...issueTemplate,
    id: 7,
    node_id: "MDU6SXNzdWUg",
    title: "Seventh issue",
    number: 7,
    body: "Seventh issue body",
    owner: "ubiquity",
    assignees: [],
    labels: [
      {
        name: "Price: 200 USD",
      },
      {
        name: "Time: 1h",
      },
      {
        name: PRIORITY_ONE.name,
      },
    ],
  });

  db.issue.create({
    ...issueTemplate,
    id: 8,
    node_id: "MDU6SXNzdWUg",
    title: "Eighth issue",
    number: 8,
    body: "Eighth issue body",
    owner: "ubiquity",
    assignees: [],
    labels: [
      {
        name: "Price: 15000 USD",
      },
      {
        name: "Time: 1h",
      },
      {
        name: PRIORITY_ONE.name,
      },
    ],
  });

  db.pull.create({
    id: 1,
    html_url: "https://github.com/ubiquity/test-repo/pull/1",
    number: 1,
    author: {
      id: 2,
      name: "user2",
    },
    user: {
      id: 2,
      login: "user2",
    },
    body: "Pull body",
    owner: "ubiquity",
    repo: "test-repo",
    state: "open",
    closed_at: null,
  });

  db.pull.create({
    id: 2,
    html_url: "https://github.com/ubiquity/test-repo/pull/2",
    number: 2,
    author: {
      id: 2,
      name: "user2",
    },
    user: {
      id: 2,
      login: "user2",
    },
    body: "Pull request",
    owner: "ubiquity",
    repo: "test-repo",
    state: "open",
    closed_at: null,
  });

  db.pull.create({
    id: 3,
    html_url: "https://github.com/ubiquity/test-repo/pull/3",
    number: 3,
    author: {
      id: 1,
      name: "ubiquity",
    },
    user: {
      id: 1,
      login: "ubiquity",
    },
    body: "Pull request body",
    owner: "ubiquity",
    repo: "test-repo",
    state: "open",
    closed_at: null,
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

  const CROSS_REFERENCED = "cross-referenced";

  db.event.create({
    id: 1,
    created_at: new Date().toISOString(),
    actor: {
      id: 2,
      name: "user2",
      login: "user2",
      type: "User",
    },
    commit_id: "123",
    commit_url: "",
    event: CROSS_REFERENCED,
    issue_number: 1,
    owner: "ubiquity",
    repo: "test-repo",
    source: {
      issue: {
        number: 10,
        state: "open",
        body: `Resolves #2`,
        html_url: "https://github.com/ubiquity/test-repo/pull/10",
        repository: {
          full_name: TEST_REPO,
        },
        user: {
          login: "ubiquity",
        },
        pull_request: {
          html_url: "https://github.com/ubiquity/test-repo/pull/10",
        },
      },
    },
  });

  db.event.create({
    id: 2,
    actor: {
      id: 1,
      name: "ubiquity",
      login: "ubiquity",
      type: "User",
    },
    commit_id: "123",
    commit_url: "",
    created_at: new Date().toISOString(),
    event: CROSS_REFERENCED,
    issue_number: 2,
    owner: "ubiquity",
    repo: "test-repo",
    source: {
      issue: {
        number: 2,
        state: "open",
        body: `Resolves #2`,
        html_url: "http://github.com/ubiquity/test-repo/pull/2",
        repository: {
          full_name: TEST_REPO,
        },
        user: {
          login: "user2",
        },
        pull_request: {
          html_url: "http://github.com/ubiquity/test-repo/pull/2",
        },
      },
    },
  });

  db.event.create({
    id: 3,
    commit_id: "123",
    commit_url: "",
    created_at: new Date().toISOString(),
    event: CROSS_REFERENCED,
    issue_number: 2,
    owner: "ubiquity",
    repo: "test-repo",
    source: {
      issue: {
        number: 3,
        state: "open",
        body: `Resolves #2`,
        html_url: "http://github.com/ubiquity/test-repo/pull/3",
        repository: {
          full_name: TEST_REPO,
        },
        user: {
          login: "user2",
        },
        pull_request: {
          html_url: "http://github.com/ubiquity/test-repo/pull/3",
        },
      },
    },
  });

  db.event.create({
    id: 4,
    actor: {
      id: 1,
      login: "ubiquity",
      type: "User",
    },
    assignee: {
      login: "user2",
    },
    created_at: new Date().toISOString(),
    event: "assigned",
    issue_number: 2,
    owner: "ubiquity",
    repo: "test-repo",
  });

  db.event.create({
    id: 5,
    actor: {
      id: 1,
      login: "ubiquity-os[bot]",
      type: "Bot",
    },
    assignee: {
      login: "user2",
    },
    created_at: new Date().toISOString(),
    event: "assigned",
    issue_number: 2,
    owner: "ubiquity",
    repo: "test-repo",
  });

  db.event.create({
    id: 6,
    actor: {
      id: 1,
      login: "ubiquity",
      type: "User",
    },
    assignee: {
      login: "user2",
    },
    created_at: new Date().toISOString(),
    event: "unassigned",
    issue_number: 2,
    owner: "ubiquity",
    repo: "test-repo",
  });

  db.comments.create({
    id: 1,
    body: "/start",
    owner: "ubiquity",
    repo: "test-repo",
  });
}

function createIssuesForMaxAssignment(n: number, userId: number) {
  const user = db.users.findFirst({ where: { id: { equals: userId } } });
  for (let i = 0; i < n; i++) {
    db.issue.create({
      ...issueTemplate,
      id: i + 9,
      assignee: user,
    });
  }
}

function getSupabase(withData = true) {
  const mockedTable = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn(() =>
          Promise.resolve({
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
          })
        ),
      }),
    }),
  };

  const mockedSupabase = {
    from: jest.fn().mockReturnValue(mockedTable),
  };

  return mockedSupabase as unknown as ReturnType<typeof createClient>;
}
