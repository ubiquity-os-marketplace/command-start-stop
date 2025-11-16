import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { parse } from "yaml";

import { RawConfiguration, RawPluginSettings } from "./types";

export function safeParseYaml(text: string | null): RawConfiguration {
  if (!text) return null;
  try {
    const data = parse(text) as unknown;
    if (data && typeof data === "object" && "plugins" in (data as Record<string, unknown>)) {
      return data as RawConfiguration;
    }
    return null;
  } catch {
    return null;
  }
}

export function mergeConfigurations(base: RawConfiguration, other: RawConfiguration): RawConfiguration {
  const resultPlugins = { ...(base?.plugins ?? {}) } as Record<string, RawPluginSettings>;
  for (const [k, v] of Object.entries(other?.plugins ?? {})) {
    resultPlugins[k] = v;
  }
  return { plugins: resultPlugins };
}

export function parseAndMergeConfigs(orgText: string | null, repoText: string | null, logger: Logs): RawConfiguration {
  try {
    const orgCfg = safeParseYaml(orgText);
    const repoCfg = safeParseYaml(repoText);
    return mergeConfigurations(orgCfg, repoCfg);
  } catch (e) {
    logger.error("Error parsing or merging configuration files", { e });
    throw e;
  }
}
