import { app } from "@azure/functions";
import { azureHonoHandler } from "@marplex/hono-azurefunc-adapter";
import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import manifest from "../../manifest.json";
import { createAdapters } from "../adapters";
import { startStopTask } from "../plugin";
import { Env, envSchema, PluginSettings, pluginSettingsSchema, SupportedEvents } from "../types";
import { Command } from "../types/command";

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
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? LOG_LEVEL.INFO,
    kernelPublicKey: process.env.KERNEL_PUBLIC_KEY,
    bypassSignatureVerification: process.env.NODE_ENV === "local",
  }
);

app.http("http-trigger", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "{*proxy}",
  handler: azureHonoHandler(honoApp.fetch),
});
