import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { createClient } from "@supabase/supabase-js";
import { createAdapters } from "../src/adapters";
import { startStopTask } from "../src/plugin";
import { Context } from "../src/types/index";
import { db } from "./__mocks__/db";
import issueTemplate from "./__mocks__/issue-template";
import { server } from "./__mocks__/node";
import { createContext } from "./utils";

const TEST_USER_ID = 3;
type Issue = Context<"issue_comment.created">["payload"]["issue"];
type PayloadSender = Context["payload"]["sender"];

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => server.close());

describe("test", () => {
  beforeEach(async () => {
    drop(db);
    jest.clearAllMocks();
    await setupTests();
  });
  it("should block bounty tasks when price limit is negative", async () => {
    db.users.create({
      id: TEST_USER_ID,
      login: "test-user",
      role: "contributor",
      created_at: new Date("2020-01-01T00:00:00Z").toISOString(),
      xp: 5000,
      wallet: null,
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
    const context = { ...(await createContext(issue, sender, "/start")), issue: {} } as Context<"issue_comment.created">;
    context.config.taskAccessControl.usdPriceMax = {
      collaborator: -1,
      contributor: -1,
    };

    context.adapters = createAdapters(getSupabase(), context);

    await expect(startStopTask(context)).rejects.toMatchObject({
      logMessage: { raw: "External contributors are not eligible for rewards at this time. We are preserving resources for core team only." },
    });
  });
});

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
