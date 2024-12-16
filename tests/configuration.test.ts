import { Value } from "@sinclair/typebox/value";
import { AssignedIssueScope, PluginSettings, pluginSettingsSchema, Role } from "../src/types";
import cfg from "./__mocks__/valid-configuration.json";

const PRIORITY_LABELS = [
  { name: "Priority: 1 (Normal)", roles: ["admin", "member", "contributor", "owner", "billing_manager"] },
  { name: "Priority: 2 (Medium)", roles: ["admin", "member", "contributor", "owner", "billing_manager"] },
  { name: "Priority: 3 (High)", roles: ["admin", "member", "contributor", "owner", "billing_manager"] },
  { name: "Priority: 4 (Urgent)", roles: ["admin", "member", "contributor", "owner", "billing_manager"] },
  { name: "Priority: 5 (Emergency)", roles: ["admin", "member", "contributor", "owner", "billing_manager"] },
];

describe("Configuration tests", () => {
  it("Should decode the configuration", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      reviewDelayTolerance: "1 Day",
      taskStaleTimeoutDuration: "30 Days",
      startRequiresWallet: true,
      assignedIssueScope: AssignedIssueScope.ORG,
      emptyWalletText: "Please set your wallet address with the /wallet command first and try again.",
      maxConcurrentTasks: { admin: 20, member: 10, contributor: 2 },
      rolesWithReviewAuthority: [Role.OWNER, Role.ADMIN, Role.MEMBER],
      requiredLabelsToStart: PRIORITY_LABELS,
    }) as PluginSettings;
    expect(settings).toEqual(cfg);
  });
  it("Should default the admin to infinity if missing from config when decoded", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      requiredLabelsToStart: PRIORITY_LABELS,
    }) as PluginSettings;
    console.dir([...Value.Errors(pluginSettingsSchema, settings)]);
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    expect(decodedSettings.maxConcurrentTasks["admin"]).toEqual(Infinity);
  });
});
