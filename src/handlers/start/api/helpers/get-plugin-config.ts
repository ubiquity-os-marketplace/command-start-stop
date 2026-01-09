import { ConfigurationHandler } from "@ubiquity-os/plugin-sdk/configuration";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import manifest from "../../../../../manifest.json" with { type: "json" };
import { Logs } from "../../../../types/context";
import { Env } from "../../../../types/env";
import { PluginSettings } from "../../../../types/plugin-input";
import { isInstallationToken } from "../../../../utils/token";
import { createOctokitInstances } from "./config/fetching";
import { getDefaultConfig } from "./context-builder";
import { createUserOctokit } from "./octokit";
import { parseIssueUrl } from "./parsers";
import { StartQueryParams } from "./types";

export async function fetchMergedPluginSettings({
  env,
  issueUrl,
  logger,
  environment,
  jwt,
}: {
  env: Env;
  issueUrl: string;
  logger: Logs;
  environment: StartQueryParams["environment"];
  jwt: string;
}): Promise<PluginSettings> {
  const repoParts = parseIssueUrl(issueUrl, logger);
  const { owner, repo } = repoParts;

  // Use App-authenticated Octokit to read configs (user PAT may lack perms)
  let octokitInstance;
  if (isInstallationToken(jwt)) {
    octokitInstance = await createUserOctokit(jwt);
  } else {
    const { orgOctokit, repoOctokit } = await createOctokitInstances(env, owner, repo, logger);
    octokitInstance = repoOctokit ?? orgOctokit;
  }

  const cfgParser = new ConfigurationHandler(logger, octokitInstance, environment ?? null);

  return (await cfgParser.getSelfConfiguration<PluginSettings>(manifest as Manifest, { owner, repo })) || getDefaultConfig();
}
