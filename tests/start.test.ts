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

type Issue = Context<"issue_comment.created">["payload"]["issue"];
type PayloadSender = Context["payload"]["sender"];

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => server.close());

beforeEach(async () => {
  jest.clearAllMocks();
  jest.resetModules();
  await setupTests();
});

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
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Issue;
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as PayloadSender;
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
});
