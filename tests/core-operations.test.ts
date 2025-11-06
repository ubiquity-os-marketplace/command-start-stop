import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Context } from "../src/types";
import { db } from "./__mocks__/db";
import issueTemplate from "./__mocks__/issue-template";
import { server } from "./__mocks__/node";
import { createContext } from "./utils";

const TEST_USER_ID = 3;
const supabaseModulePath = "@supabase/supabase-js";
const adaptersModulePath = "../src/adapters";
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
      type: "Organization",
    },
    issues: [],
  });
}

describe("test", () => {
  beforeEach(async () => {
    drop(db);
    jest.clearAllMocks();
    jest.resetModules();
    jest.resetAllMocks();
    await setupTests();
  });
  it("should block bounty tasks when price limit is negative", async () => {
    jest.unstable_mockModule(supabaseModulePath, () => ({
      createClient: jest.fn(),
    }));
    jest.unstable_mockModule(adaptersModulePath, () => ({
      createAdapters: jest.fn(() => ({
        supabase: {
          user: {
            getWalletByUserId: jest.fn(() => Promise.resolve(null)),
          },
        },
      })),
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
      logMessage: { raw: "External contributors are not eligible for rewards at this time. We are preserving resources for core team only." },
    });
  });
});
