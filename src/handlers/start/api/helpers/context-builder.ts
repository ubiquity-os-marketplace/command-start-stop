import { createClient } from "@supabase/supabase-js";
import { Context } from "../../../../types/context";
import { AssignedIssueScope, PluginSettings, Role } from "../../../../types/plugin-input";
import { Env } from "../../../../types/env";
import { createAdapters } from "../../../../adapters/index";
import { createUserOctokit } from "./octokit";
import { MAX_CONCURRENT_DEFAULTS } from "../../../../utils/constants";
import { LogLevel, LogReturn, Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Issue, Organization, Repository } from "../../../../types";

export type ShallowContext = Omit<Context<"issue_comment.created">, "repository" | "issue" | "organization" | "organizations" | "payload"> & {
  env: Env;
  payload: {
    sender: {
      login?: string;
      id: number;
    };
  };
};

/**
 * Builds a partner context-free context object
 *
 * DOES NOT load payload, repository, issue, organization.
 * These must be injected once you know them.
 */
export async function buildShallowContextObject({ env, userAccessToken }: { env: Env; userAccessToken: string }): Promise<ShallowContext> {
  const { octokit, supabase } = await initializeClients(env, userAccessToken);
  const userData = await octokit.rest.users.getAuthenticated();

  const ctx: ShallowContext = {
    env,
    octokit,
    logger: createLogger(env),
    config: getDefaultConfig(),
    command: createCommand([userData.data.login]),
    eventName: "issue_comment.created" as const,
    commentHandler: createCommentHandler({
      userOctokit: octokit,
    }),
    payload: {
      sender: {
        login: userData.data.login,
        id: userData.data.id,
      },
    },
    adapters: {} as unknown as Context["adapters"],
  };

  ctx.adapters = createAdapters(supabase, ctx as Context);
  return ctx;
}

export function createCommentHandler({ userOctokit }: { userOctokit: Awaited<ReturnType<typeof createUserOctokit>> }): Context["commentHandler"] {
  return {
    postComment: async (context: Context<"issue_comment.created">, msg: LogReturn | string) => {
      const body = typeof msg === "string" ? msg : msg?.logMessage?.raw || String(msg);
      await userOctokit.rest.issues.createComment({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        issue_number: context.payload.issue.number,
        body,
      });
    },
  } as unknown as Context["commentHandler"];
}

export function createPayload({
  issue,
  repository,
  organization,
  sender,
}: {
  sender: { login?: string; id: number };
  issue: Issue;
  repository: Repository;
  organization: Organization;
}): Context["payload"] {
  return {
    action: "created",
    issue,
    repository,
    organization,
    sender,
    comment: {
      issue_url: issue.url,
      user: sender,
      body: "/start",
    },
  } as unknown as Context["payload"];
}

export function createCommand(assignees: string[]): Context["command"] {
  return {
    name: "start",
    parameters: {
      teammates: assignees,
    },
  };
}

function getDefaultConfig(): PluginSettings {
  return {
    reviewDelayTolerance: "3 Days",
    taskStaleTimeoutDuration: "30 Days",
    maxConcurrentTasks: MAX_CONCURRENT_DEFAULTS,
    startRequiresWallet: false,
    assignedIssueScope: AssignedIssueScope.ORG,
    emptyWalletText: "Please set your wallet address with the /wallet command first and try again.",
    rolesWithReviewAuthority: [Role.ADMIN, Role.OWNER, Role.MEMBER],
    requiredLabelsToStart: [
      { name: "Priority: 1 (Normal)", allowedRoles: ["collaborator", "contributor"] },
      { name: "Priority: 2 (Medium)", allowedRoles: ["collaborator", "contributor"] },
      { name: "Priority: 3 (High)", allowedRoles: ["collaborator", "contributor"] },
      { name: "Priority: 4 (Urgent)", allowedRoles: ["collaborator", "contributor"] },
      { name: "Priority: 5 (Emergency)", allowedRoles: ["collaborator", "contributor"] },
    ],
    taskAccessControl: {
      usdPriceMax: {
        collaborator: -1,
        contributor: -1,
      },
    },
  } as PluginSettings;
}

function createLogger(env: Env): Logs {
  return new Logs((env.LOG_LEVEL as LogLevel) ?? "info");
}

async function initializeClients(env: Env, userAccessToken: string) {
  const octokit = await createUserOctokit(userAccessToken);
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  return { octokit, supabase };
}
