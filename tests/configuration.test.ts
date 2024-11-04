import { Value } from "@sinclair/typebox/value";
import { PluginSettings, pluginSettingsSchema } from "../src/types";
import cfg from "./__mocks__/valid-configuration.json";

describe("Configuration tests", () => {
  it("Should decode the configuration", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      reviewDelayTolerance: "1 Day",
      taskStaleTimeoutDuration: "30 Days",
      startRequiresWallet: true,
      emptyWalletText: "Please set your wallet address with the /wallet command first and try again.",
      maxConcurrentTasks: { admin: 20, member: 10, contributor: 2 },
      rolesWithReviewAuthority: ["OWNER", "ADMIN", "MEMBER"],
    }) as PluginSettings;
    expect(settings).toEqual(cfg);
  });
  it("Should default the admin to infinity if missing from config when decoded", () => {
    const settings = Value.Default(pluginSettingsSchema, {}) as PluginSettings;
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    expect(decodedSettings.maxConcurrentTasks["admin"]).toEqual(Infinity);
  });

  it("Should normalize maxConcurrentTasks role keys to lowercase when decoded", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      maxConcurrentTasks: { ADMIN: 20, memBER: 10, CONTRIBUTOR: 2 },
    }) as PluginSettings;
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    expect(decodedSettings.maxConcurrentTasks).toEqual({ admin: 20, member: 10, contributor: 2 });
  });
});
