import type { PluginSettings } from "../../../../../types/plugin-input";

export type RawPluginSettings = null | ({ with?: PluginSettings } & Record<string, unknown>);
export type RawConfiguration = { plugins?: Record<string, RawPluginSettings> } | null;
