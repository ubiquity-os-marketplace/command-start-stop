import { CONFIG_FULL_PATH, CONFIG_ORG_REPO, DEV_CONFIG_FULL_PATH } from "@ubiquity-os/plugin-sdk/constants";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";

import { Env } from "../../../../../types/env";
import { createAppOctokit, createRepoOctokit, CustomOctokit } from "../octokit";

export function pickConfigPath(env: Env): string {
  const nodeEnv = (env.NODE_ENV || "").toLowerCase();
  return nodeEnv === "development" || nodeEnv === "local" ? DEV_CONFIG_FULL_PATH : CONFIG_FULL_PATH;
}

export async function fetchRawConfigWithOctokit({ owner, repo, path, octokit }: { owner: string; repo: string; path: string; octokit: CustomOctokit }) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      mediaType: { format: "raw" },
    });
    return typeof data === "string" ? data : null;
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Failed to fetch config from ${owner}/${repo}/${path}: ${e.message}`);
    } else {
      throw e;
    }
  }
}

export async function createOctokitInstances(env: Env, owner: string, repo: string, logger: Logs) {
  try {
    const orgOctokit = await createAppOctokit(env);
    const repoOctokit = await createRepoOctokit(env, owner, repo);
    return { orgOctokit, repoOctokit };
  } catch (e) {
    logger.error("Error creating Octokit instances for fetching plugin settings", { e });
    throw e;
  }
}

export async function fetchOrgAndRepoConfigTexts(params: {
  owner: string;
  repo: string;
  path: string;
  orgOctokit: CustomOctokit;
  repoOctokit: CustomOctokit;
  logger: Logs;
}) {
  const { owner, repo, path, orgOctokit, repoOctokit, logger } = params;
  try {
    const [orgText, repoText] = await Promise.all([
      fetchRawConfigWithOctokit({ owner, repo: CONFIG_ORG_REPO, path, octokit: orgOctokit }).catch(() => null),
      fetchRawConfigWithOctokit({ owner, repo, path, octokit: repoOctokit }).catch(() => null),
    ]);
    return { orgText, repoText } as { orgText: string | null; repoText: string | null };
  } catch (e) {
    logger.error("Error fetching raw configuration files", { e });
    throw e;
  }
}
