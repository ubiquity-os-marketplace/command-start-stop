import { Value } from "@sinclair/typebox/value";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";

import { getPluginSettingsValidator, PluginSettings, pluginSettingsSchema } from "../../../../../types/plugin-input";

import { RawConfiguration } from "./types";

export function extractAndValidatePluginSettings(mergedCfg: RawConfiguration, owner: string, repo: string, logger: Logs): PluginSettings | null {
  try {
    const keys = Object.keys(mergedCfg?.plugins ?? {});
    const key = keys.find((k) => k.includes("command-start-stop"));

    if (!key) return null;

    const rawSettings = mergedCfg?.plugins?.[key]?.with ?? null;
    if (!rawSettings) {
      logger.info(`No 'with' settings found for ${owner}/${repo} under key ${key}, using default settings.`);
      return null;
    }

    const validator = getPluginSettingsValidator();
    if (!validator.test(rawSettings)) {
      logger.warn(`Plugin settings for ${owner}/${repo} under key ${key} failed validation, using default settings.`);
      logger.error(`Validation errors: ${JSON.stringify([...validator.errors(rawSettings)])}`);
      return null;
    }

    return Value.Decode(pluginSettingsSchema, rawSettings);
  } catch (e) {
    logger.error("Error validating plugin settings", { e });
    throw e;
  }
}
