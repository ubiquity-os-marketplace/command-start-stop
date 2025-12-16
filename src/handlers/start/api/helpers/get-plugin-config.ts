import { ConfigurationHandler } from "@ubiquity-os/plugin-sdk/configuration";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import manifest from "../../../../../manifest.json" with { type: "json" };
import { Logs } from "../../../../types/context";
import { Env } from "../../../../types/env";
import { PluginSettings } from "../../../../types/plugin-input";
import { createOctokitInstances } from "./config/fetching";
import { getDefaultConfig } from "./context-builder";
import { parseIssueUrl } from "./parsers";

export async function fetchMergedPluginSettings({ env, issueUrl, logger }: { env: Env; issueUrl: string; logger: Logs }): Promise<PluginSettings> {
  const repoParts = parseIssueUrl(issueUrl, logger);
  const { owner, repo } = repoParts;

  // Use App-authenticated Octokit to read configs (user PAT may lack perms)
  const { orgOctokit, repoOctokit } = await createOctokitInstances(env, owner, repo, logger);

  const cfgParser = new ConfigurationHandler(logger, repoOctokit ?? orgOctokit);

  return (await cfgParser.getSelfConfiguration<PluginSettings>(manifest as Manifest, { owner, repo })) || getDefaultConfig();
}
