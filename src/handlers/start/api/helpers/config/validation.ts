import { Value } from "@sinclair/typebox/value";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { getRuntimeKey } from "hono/adapter";
import PKG from "../../../../../../package.json" with { type: "json" };
import { Env } from "../../../../../types";
import { PluginSettings, pluginSettingsSchema } from "../../../../../types/plugin-input";
import { RawConfiguration } from "./types";

/**
 * in development, the key for a plugin is typically localhost or some raw
 * IP address. This helper function standardizes the key used for local
 * development so that validation and extraction logic can remain consistent.
 *
 * First, parse the package.json to get the host and port. Then, construct
 * the plugin key in the format "http://host:port" or "https://host:port".
 *
 * @returns The standardized plugin key for local development.
 */
async function localHostPluginKeyHelper(env: Env) {
  const isDev = env.NODE_ENV !== "production";
  if (!isDev) return;

  const runtime = getRuntimeKey();
  let cmd;

  if (runtime === "deno") {
    cmd = PKG?.scripts["dev:deno"];
  } else if (runtime === "node" || runtime === "bun") {
    cmd = PKG?.scripts["dev"];
  } else if (runtime === "workerd") {
    cmd = PKG?.scripts["worker"];
  }

  if (!cmd) return;

  const hostMatch = cmd.match(/--host\s+([^\s]+)/);
  const portMatch = cmd.match(/--port\s+([^\s]+)/);

  const host = hostMatch ? hostMatch[1] : "localhost";
  const port = portMatch ? portMatch[1] : "4002";
  const protocol = host.includes("https") ? "https" : "http";

  return `${protocol}://${host}:${port}`;
}

export async function extractAndValidatePluginSettings({
  mergedCfg,
  owner,
  repo,
  logger,
  env,
}: {
  mergedCfg: RawConfiguration;
  owner: string;
  repo: string;
  logger: Logs;
  env: Env;
}): Promise<PluginSettings | null> {
  try {
    const keys = Object.values(mergedCfg?.plugins ?? { uses: [] })
      .map((p) => p.uses?.[0]?.plugin)
      .filter((p): p is string => typeof p === "string");
    let key = keys.find((k) => k.includes("command-start-stop"));

    if (!key && env.NODE_ENV !== "production") {
      key = await localHostPluginKeyHelper(env);
      logger.info(`Official deployment of command-start-stop plugin not found for ${owner}/${repo}, checking for local development key.`, {
        localDevKey: key,
      });
    }

    if (!key) {
      logger.info(`No command-start-stop plugin configuration found for ${owner}/${repo} with key: ${keys.join(", ")}`);
      return null;
    }

    const pluginConfig = Object.values(mergedCfg?.plugins ?? { uses: [] }).find((p) => p.uses?.[0]?.plugin === key);

    if (!pluginConfig) {
      logger.info(`No 'with' settings found for ${owner}/${repo} under key ${key}, using default settings.`);
      return null;
    }

    const rawSettings = pluginConfig.uses?.[0]?.with;

    if (!rawSettings) {
      logger.info(`No 'with' settings found for ${owner}/${repo} under key ${key}, using default settings.`);
      return null;
    }

    return Value.Decode(pluginSettingsSchema, Value.Default(pluginSettingsSchema, rawSettings));
  } catch (e) {
    logger.error("Error validating plugin settings", { e });
    throw e;
  }
}
