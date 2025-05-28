import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "hono";
import manifest from "../manifest.json" with { type: "json" };
import { createAdapters } from "./adapters/index.ts";
import { startStopTask } from "./plugin.ts";
import { Command } from "./types/command.ts";
import { SupportedEvents } from "./types/context.ts";
import { Env, envSchema } from "./types/env.ts";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input.ts";

export default {
  async fetch(request: Request, env: Record<string, unknown>, executionCtx?: ExecutionContext) {
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
        logLevel: (Deno.env.get("LOG_LEVEL") as LogLevel) ?? LOG_LEVEL.INFO,
        kernelPublicKey: Deno.env.get("KERNEL_PUBLIC_KEY") as string,
        bypassSignatureVerification: Deno.env.get("NODE_ENV") === "local",
      }
    );

    return honoApp.fetch(request, env, executionCtx);
  },
};
