import { Value } from "@sinclair/typebox/value";
import { AssignedIssueScope, PluginSettings, pluginSettingsSchema } from "../src/types";
import cfg from "./__mocks__/valid-configuration.json";

const PRIORITY_LABELS = ["Priority: 1 (Normal)", "Priority: 2 (Medium)", "Priority: 3 (High)", "Priority: 4 (Urgent)", "Priority: 5 (Emergency)"];

describe("Configuration tests", () => {
  it("Should decode the configuration", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      reviewDelayTolerance: "1 Day",
      taskStaleTimeoutDuration: "30 Days",
      startRequiresWallet: true,
      assignedIssueScope: AssignedIssueScope.ORG,
      emptyWalletText: "Please set your wallet address with the /wallet command first and try again.",
      maxConcurrentTasks: { admin: 20, member: 10, contributor: 2 },
      rolesWithReviewAuthority: ["OWNER", "ADMIN", "MEMBER"],
      requiredLabelsToStart: PRIORITY_LABELS,
    }) as PluginSettings;
    expect(settings).toEqual(cfg);
  });
  it("Should default the admin to infinity if missing from config when decoded", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      requiredLabelsToStart: PRIORITY_LABELS,
    }) as PluginSettings;
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    expect(decodedSettings.maxConcurrentTasks["admin"]).toEqual(Infinity);
  });

  it("Should normalize maxConcurrentTasks role keys to lowercase when decoded", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      maxConcurrentTasks: { ADMIN: 20, memBER: 10, CONTRIBUTOR: 2 },
      requiredLabelsToStart: PRIORITY_LABELS,
    }) as PluginSettings;
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    expect(decodedSettings.maxConcurrentTasks).toEqual({ admin: 20, member: 10, contributor: 2 });
  });
});
