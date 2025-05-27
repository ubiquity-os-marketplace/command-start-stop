import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "npm:hono";
import manifest from "../manifest.json" with { type: "json" };
import { createAdapters } from "./adapters/index.ts";
import { startStopTask } from "./plugin.ts";
import { Command } from "./types/command.ts";
import { SupportedEvents } from "./types/context.ts";
import { Env, envSchema } from "./types/env.ts";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input.ts";

export default {
  async fetch(request: Request, env: Record<string, unknown>, executionCtx?: ExecutionContext) {
    const nodeEnv = (env.NODE_ENV as string) || "development";

    console.log("env:", nodeEnv);

    const honoApp = createPlugin<PluginSettings, Env, Command, SupportedEvents>(
      (context) => {
        return startStopTask({
          ...context,
          adapters: {} as ReturnType<typeof createAdapters>,
          organizations: [],
        });
      },
      manifest as Manifest,
      {
        envSchema: envSchema,
        postCommentOnError: true,
        settingsSchema: pluginSettingsSchema,
        logLevel: (env.LOG_LEVEL as LogLevel) ?? LOG_LEVEL.INFO,
        kernelPublicKey: env.KERNEL_PUBLIC_KEY as string,
        bypassSignatureVerification: nodeEnv === "local",
      }
    );

    return honoApp.fetch(request, env, executionCtx);
  },
};
