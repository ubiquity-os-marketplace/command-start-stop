import { createAppAuth } from "@octokit/auth-app";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Env } from "../../../../types/env";

export async function createAppOctokit(env: Env) {
  return new customOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.APP_ID,
      privateKey: env.APP_PRIVATE_KEY,
    },
  });
}

export async function createRepoOctokit(env: Env, owner: string, repo: string) {
  const appOctokit = await createAppOctokit(env);
  const installation = await appOctokit.rest.apps.getRepoInstallation({ owner, repo });

  return new customOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: Number(env.APP_ID),
      privateKey: env.APP_PRIVATE_KEY,
      installationId: installation.data.id,
    },
  });
}
