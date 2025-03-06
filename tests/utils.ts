import { CommentHandler } from "@ubiquity-os/plugin-sdk";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { createAdapters } from "../src/adapters";
import { AssignedIssueScope, Context, Role, SupportedEvents } from "../src/types";
import { db } from "./__mocks__/db";

const octokit = await import("@octokit/rest");
const PRIORITY_ONE = { name: "Priority: 1 (Normal)", allowedRoles: ["collaborator", "contributor"] };
const priority3LabelName = "Priority: 3 (High)";
const priority4LabelName = "Priority: 4 (Urgent)";
const priority5LabelName = "Priority: 5 (Emergency)";
const PRIORITY_LABELS = [
  PRIORITY_ONE,
  {
    name: "Priority: 2 (Medium)",
    allowedRoles: ["collaborator", "contributor"],
  },
  {
    name: priority3LabelName,
    allowedRoles: ["collaborator", "contributor"],
  },
  {
    name: priority4LabelName,
    allowedRoles: ["collaborator", "contributor"],
  },
  {
    name: priority5LabelName,
    allowedRoles: ["collaborator", "contributor"],
  },
];

export const MAX_CONCURRENT_DEFAULTS = {
  collaborator: 6,
  contributor: 4,
};

export function createContext(
  issue: Record<string, unknown>,
  sender: Record<string, unknown> | undefined,
  body = "/start",
  appId: string | null = "1",
  startRequiresWallet = false,
  requiredLabelsToStart = PRIORITY_LABELS
): Context {
  return {
    adapters: {} as ReturnType<typeof createAdapters>,
    payload: {
      issue: issue as unknown as Context<"issue_comment.created">["payload"]["issue"],
      sender: sender as unknown as Context["payload"]["sender"],
      repository: db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Context["payload"]["repository"],
      comment: { body } as unknown as Context<"issue_comment.created">["payload"]["comment"],
      action: "created",
      installation: { id: 1 } as unknown as Context["payload"]["installation"],
      organization: { login: "ubiquity" } as unknown as Context["payload"]["organization"],
      assignee: {
        ...sender,
      },
    } as Context["payload"],
    logger: new Logs("debug") as unknown as Context["logger"],
    config: {
      reviewDelayTolerance: "3 Days",
      taskStaleTimeoutDuration: "30 Days",
      maxConcurrentTasks: MAX_CONCURRENT_DEFAULTS,
      startRequiresWallet,
      assignedIssueScope: AssignedIssueScope.ORG,
      emptyWalletText: "Please set your wallet address with the /wallet command first and try again.",
      rolesWithReviewAuthority: [Role.ADMIN, Role.OWNER, Role.MEMBER],
      requiredLabelsToStart,
      taskAccessControl: {
        priceMaxUSD: {
          admin: 10000,
          collaborator: 10000,
          contributor: 1000,
        },
      },
    },
    octokit: new octokit.Octokit(),
    eventName: "issue_comment.created" as SupportedEvents,
    organizations: ["ubiquity"],
    env: {
      APP_ID: appId,
      APP_PRIVATE_KEY: "private_key",
      SUPABASE_KEY: "key",
      SUPABASE_URL: "url",
      BOT_USER_ID: appId as unknown as number,
    },
    command: null,
    commentHandler: new CommentHandler(),
  } as unknown as Context;
}
