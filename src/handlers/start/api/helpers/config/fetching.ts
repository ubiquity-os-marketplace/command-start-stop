import { CONFIG_FULL_PATH, CONFIG_ORG_REPO, DEV_CONFIG_FULL_PATH } from "@ubiquity-os/plugin-sdk/constants";
import { Logs } from "../../../../../types/context";
import { Env } from "../../../../../types/env";
import { createAppOctokit, createRepoOctokit, CustomOctokit } from "../octokit";

export function pickConfigPath(env: Env): string {
  const nodeEnv = (env.NODE_ENV || "").toLowerCase();
  return nodeEnv === "development" || nodeEnv === "local" ? DEV_CONFIG_FULL_PATH : CONFIG_FULL_PATH;
}

export async function fetchRawConfigWithOctokit({
  owner,
  repo,
  path,
  octokit,
  env,
  logger,
}: {
  owner: string;
  repo: string;
  path: string;
  octokit?: CustomOctokit;
  env: Env;
  logger: Logs;
}) {
  if (!octokit && env.NODE_ENV !== "production") {
    // we couldn't create a repoOctokit, so in non-production just return null
    // and use their org config
    return null;
  } else if (octokit && env.NODE_ENV !== "production") {
    // In non-production, fetch the app's owner config repo instead
    const { data: installations } = await octokit.rest.apps.listInstallations();

    if (installations.length === 0) {
      logger.warn("No installations found for the authenticated app user, cannot fetch config from app owner repo.");
      return null;
    }

    if (installations.length > 1) {
      logger.warn("Multiple installations found for the authenticated app user, using the first one.");
    }

    const appOwner = installations[0].account?.login;
    if (!appOwner) {
      logger.warn("Failed to determine app owner from installation data, cannot fetch config from app owner repo.");
      return null;
    }

    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: appOwner,
        repo: CONFIG_ORG_REPO,
        path,
        mediaType: { format: "raw" },
      });
      return typeof data === "string" ? data : null;
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      } else {
        throw logger.error("Failed to fetch config from {owner}/{repo}/{path}: {e}", { e: String(e) });
      }
    }
  } else if (!octokit) {
    throw logger.error("Octokit instance is required to fetch configuration in production environment");
  }

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
      throw e;
    } else {
      throw logger.error("Failed to fetch config from {owner}/{repo}/{path}: {e}", { e: String(e) });
    }
  }
}

export async function createOctokitInstances(env: Env, owner: string, repo: string, logger: Logs) {
  let orgOctokit, repoOctokit;
  let orgError, repoError;

  try {
    orgOctokit = await createAppOctokit(env);
  } catch (e) {
    orgError = e;
    logger.error("Error creating Org Octokit instance for fetching plugin settings", { e });
  }

  try {
    repoOctokit = await createRepoOctokit(env, owner, repo);
  } catch (e) {
    repoError = e;
    logger.error("Error creating Repo Octokit instance for fetching plugin settings", { e });
  }

  if (env.NODE_ENV === "production") {
    if (!orgOctokit || !repoOctokit) {
      throw logger.error("Failed to create Octokit instances", {
        cause: { orgError, repoError },
      });
    }
  } else {
    if (!repoOctokit) {
      logger.warn("Repo Octokit instance not created in non-production environment, proceeding without it.");
    }
  }

  if (!orgOctokit) {
    /**
     * orgOctokit should always be created even in non-production, as it uses app auth only
     * it won't be able to fetch production devpool task org configs, but we can try fetch the config
     * from the app's owner config repo instead if needed.
     */
    throw new Error("Failed to create Org Octokit instance", {
      cause: { orgError },
    });
  }

  return { orgOctokit, repoOctokit };
}

export async function fetchOrgAndRepoConfigTexts(params: {
  owner: string;
  repo: string;
  path: string;
  orgOctokit: CustomOctokit;
  logger: Logs;
  env: Env;
  repoOctokit?: CustomOctokit;
}) {
  const { owner, repo, path, orgOctokit, repoOctokit, logger, env } = params;
  try {
    const [orgText, repoText] = await Promise.all([
      fetchRawConfigWithOctokit({ owner, repo: CONFIG_ORG_REPO, path, octokit: orgOctokit, env, logger }).catch(() => null),
      fetchRawConfigWithOctokit({ owner, repo, path, octokit: repoOctokit, env, logger }).catch(() => null),
    ]);

    return { orgText, repoText } as { orgText: string | null; repoText: string | null };
  } catch (e) {
    throw logger.error("Error fetching raw configuration files", { e: String(e) });
  }
}
