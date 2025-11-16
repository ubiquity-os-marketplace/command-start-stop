import { CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";

import { Env } from "../../../../types/env";
import { PluginSettings } from "../../../../types/plugin-input";

import { createOctokitInstances, fetchOrgAndRepoConfigTexts, pickConfigPath } from "./config/fetching";
import { parseAndMergeConfigs } from "./config/parsing";
import { extractAndValidatePluginSettings } from "./config/validation";
import { getDefaultConfig } from "./context-builder";
import { parseIssueUrl } from "./parsers";

export async function fetchMergedPluginSettings({ env, issueUrl, logger }: { env: Env; issueUrl: string; logger: Logs }): Promise<PluginSettings> {
  const repoParts = parseIssueUrl(issueUrl);
  const { owner, repo } = repoParts;

  // Resolve dev/prod config path using SDK constants
  const path = pickConfigPath(env);

  // Use App-authenticated Octokit to read configs (user PAT may lack perms)
  const { orgOctokit, repoOctokit } = await createOctokitInstances(env, owner, repo, logger);

  const { orgText, repoText } = await fetchOrgAndRepoConfigTexts({ owner, repo, path, orgOctokit, repoOctokit, logger });

  const mergedCfg = parseAndMergeConfigs(orgText, repoText, logger);

  if (!mergedCfg) {
    logger.info(`No valid configuration found for ${owner}/${CONFIG_ORG_REPO} or ${owner}/${repo}, using default settings.`);
    return getDefaultConfig();
  }

  const settings = extractAndValidatePluginSettings(mergedCfg, owner, repo, logger);
  if (settings) return settings;

  logger.info(`Neither configuration found for ${owner}/${CONFIG_ORG_REPO} or ${owner}/${repo}, using default settings.`);
  return getDefaultConfig();
}
