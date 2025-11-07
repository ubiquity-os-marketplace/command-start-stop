import { createClient } from "@supabase/supabase-js";
import { Context } from "../../../../types/context";
import { AssignedIssueScope, PluginSettings, Role } from "../../../../types/plugin-input";
import { Env } from "../../../../types/env";
import { createAdapters } from "../../../../adapters/index";
import { createRepoOctokit } from "./octokit";
import { MAX_CONCURRENT_DEFAULTS } from "../../../../utils/constants";
import { LogLevel, Logs } from "@ubiquity-os/ubiquity-os-logger";

export async function buildContext(
  env: Env,
  owner: string,
  repo: string,
  issueNumber: number,
  senderLogin: string,
  userId: number
): Promise<Context<"issue_comment.created">> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const repoOctokit = await createRepoOctokit(env, owner, repo);

  const issue = (await repoOctokit.rest.issues.get({ owner, repo, issue_number: issueNumber })).data as Context<"issue_comment.created">["payload"]["issue"];
  const repository = (await repoOctokit.rest.repos.get({ owner, repo })).data as Context<"issue_comment.created">["payload"]["repository"];

  let organization: Context["payload"]["organization"] | undefined;
  if (repository.owner.type === "Organization") {
    organization = (await repoOctokit.rest.orgs.get({ org: owner })).data as Context<"issue_comment.created">["payload"]["organization"];
  }

  // async function loadConfig(owner: string, repo: string): Promise<PluginSettings | null> {
  //   // try {
  //   //   let configFile = await repoOctokit.rest.repos.getContent({
  //   //     owner,
  //   //     repo,
  //   //     path: isDevelopment() ? DEV_CONFIG_FULL_PATH : CONFIG_FULL_PATH
  //   //   });
  //   //   if (configFile && configFile.data){
  //   //     let content;
  //   //     if ("content" in configFile.data) {
  //   //       content = configFile.data.content;
  //   //     } else if (typeof configFile.data === "string") {
  //   //       content = configFile.data;
  //   //     } else {
  //   //       throw new Error("Invalid config file");
  //   //     }
  //   //     const parsedConfig = YAML.parse(content);
  //   //     return parsedConfig as PluginSettings;
  //   //   }
  //   // } catch (error) {
  //   //   console.log("Error loading config file, using defaults:", error);
  //   // }
  //   // return null as unknown as PluginSettings;
  // }

  // Try to load the .ubiquity-os-config.yml file from the repository
  let config = null as PluginSettings | null;

  // config = await loadConfig(owner, repo);

  // if(!config) {
  //   config = await loadConfig(CONFIG_ORG_REPO, owner);
  // }

  if (!config) {
    config = {
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

  const context: Context = {
    logger: new Logs((env.LOG_LEVEL as LogLevel) ?? "info"),
    env,
    config,
    command: {
      name: "start",
      parameters: {
        teammates: [],
      },
    },
    eventName: "issue_comment.created",
    payload: {
      action: "created",
      issue,
      repository,
      organization,
      sender: { login: senderLogin, id: userId },
    } as unknown as Context["payload"],
    octokit: repoOctokit as unknown as Context["octokit"],
    adapters: {} as unknown as Context["adapters"],
    organizations: [owner],
    commentHandler: {
      postComment: async () => {
        // const body = typeof message === "string" ? message : message?.logMessage?.raw || String(message);
        // await repoOctokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
      },
    } as unknown as Context["commentHandler"],
  };

  context.adapters = createAdapters(supabase, context);

  return context as Context<"issue_comment.created">;
}
