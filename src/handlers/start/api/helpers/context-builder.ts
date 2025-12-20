import { createClient } from "@supabase/supabase-js";
import { CommentHandler } from "@ubiquity-os/plugin-sdk";
import { LogLevel, Logs } from "@ubiquity-os/ubiquity-os-logger";
import { createAdapters } from "../../../../adapters/index";
import { Context } from "../../../../types/context";
import { Env } from "../../../../types/env";
import { Issue, Organization, Repository } from "../../../../types/payload";
import { AssignedIssueScope, PluginSettings, Role } from "../../../../types/plugin-input";
import { MAX_CONCURRENT_DEFAULTS } from "../../../../utils/constants";
import { listOrganizations } from "../../../../utils/list-organizations";
import { createUserOctokit } from "./octokit";

export type ShallowContext = Omit<Context<"issue_comment.created">, "repository" | "issue" | "organization" | "payload"> & {
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
export async function buildShallowContextObject({
  env,
  accessToken,
  userId,
  logger,
}: {
  env: Env;
  accessToken: string;
  userId: number | string;
  logger: Context["logger"];
}): Promise<ShallowContext> {
  const { octokit, supabase } = await initializeClients(env, accessToken);

  const userData =
    typeof userId === "number" ? await octokit.rest.users.getById({ account_id: userId }) : await octokit.rest.users.getByUsername({ username: userId });

  const ctx: ShallowContext = {
    env,
    octokit,
    logger,
    config: getDefaultConfig(),
    command: createCommand([userData.data.login]),
    eventName: "issue_comment.created" as const,
    commentHandler: new CommentHandler(),
    payload: {
      sender: {
        login: userData.data.login,
        id: userData.data.id,
      },
    },
    adapters: {} as unknown as Context["adapters"],
    organizations: [],
  };

  ctx.organizations = await listOrganizations(ctx as Context);
  ctx.adapters = createAdapters(supabase, ctx as Context);
  return ctx;
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

export function getDefaultConfig(): PluginSettings {
  return {
    reviewDelayTolerance: "3 Days",
    taskStaleTimeoutDuration: "30 Days",
    maxConcurrentTasks: MAX_CONCURRENT_DEFAULTS,
    startRequiresWallet: false,
    assignedIssueScope: AssignedIssueScope.NETWORK,
    emptyWalletText: "Please set your wallet address with the /wallet command first and try again.",
    rolesWithReviewAuthority: [Role.ADMIN, Role.OWNER, Role.MEMBER],
    requiredLabelsToStart: [
      {
        name: "Priority: 1 (Normal)",
        allowedRoles: ["collaborator", "contributor"],
      },
      {
        name: "Priority: 2 (Medium)",
        allowedRoles: ["collaborator", "contributor"],
      },
      {
        name: "Priority: 3 (High)",
        allowedRoles: ["collaborator", "contributor"],
      },
      {
        name: "Priority: 4 (Urgent)",
        allowedRoles: ["collaborator", "contributor"],
      },
      {
        name: "Priority: 5 (Emergency)",
        allowedRoles: ["collaborator", "contributor"],
      },
    ],
    taskAccessControl: {
      usdPriceMax: {
        collaborator: 5000,
        contributor: 5000,
      },
    },
  } as PluginSettings;
}

export function createLogger(env: Env | { LOG_LEVEL?: string }): Context["logger"] {
  return new Logs((env.LOG_LEVEL as LogLevel) ?? "info") as unknown as Context["logger"];
}

async function initializeClients(env: Env, accessToken: string) {
  const octokit = await createUserOctokit(accessToken);
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  return { octokit, supabase };
}
