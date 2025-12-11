import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Env } from "../../../../../types/env";
import { createAppOctokit, createRepoOctokit } from "../octokit";

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
