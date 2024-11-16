import { createPlugin } from "@ubiquity-os/plugin-sdk";
import type { ExecutionContext } from "hono";
import { createAdapters } from "./adapters";
import { SupportedEvents } from "./types/context";
import { Env, envSchema } from "./types/env";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input";
import manifest from "../manifest.json";
import { Command } from "./types/command";
import { startStopTask } from "./plugin";

export default {
  async fetch(request: Request, env: Env, executionCtx?: ExecutionContext) {
    return createPlugin<PluginSettings, Env, Command, SupportedEvents>(
      (context) => {
        return startStopTask({
          ...context,
          adapters: {} as ReturnType<typeof createAdapters>,
          organizations: [],
        });
      },
      // @ts-expect-error incorrect types
      manifest,
      {
        envSchema: envSchema,
        postCommentOnError: true,
        settingsSchema: pluginSettingsSchema,
        logLevel: env.LOG_LEVEL,
        kernelPublicKey: env.KERNEL_PUBLIC_KEY,
      }
    ).fetch(request, env, executionCtx);
  },
};
