import { Value } from "@sinclair/typebox/value";
import { AssignedIssueScope, PluginSettings, pluginSettingsSchema, Role } from "../src/types/index";
import cfg from "./__mocks__/valid-configuration.json";

const PRIORITY_LABELS = [
  { name: "Priority: 1 (Normal)", allowedRoles: ["collaborator", "contributor"] },
  { name: "Priority: 2 (Medium)", allowedRoles: ["collaborator", "contributor"] },
  { name: "Priority: 3 (High)", allowedRoles: ["collaborator", "contributor"] },
  { name: "Priority: 4 (Urgent)", allowedRoles: ["collaborator", "contributor"] },
  { name: "Priority: 5 (Emergency)", allowedRoles: ["collaborator", "contributor"] },
];

describe("Configuration tests", () => {
  it("Should decode the configuration", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      reviewDelayTolerance: "1 Day",
      taskStaleTimeoutDuration: "30 Days",
      startRequiresWallet: true,
      assignedIssueScope: AssignedIssueScope.ORG,
      emptyWalletText: "Please set your wallet address with the /wallet command first and try again.",
      maxConcurrentTasks: { collaborator: 10, contributor: 2 },
      rolesWithReviewAuthority: [Role.OWNER, Role.ADMIN, Role.MEMBER],
      requiredLabelsToStart: PRIORITY_LABELS,
      taskAccessControl: {
        usdPriceMax: {
          collaborator: "Infinity",
          contributor: 1000,
        },
      },
    }) as PluginSettings;
    expect(settings).toEqual(cfg);
  });
  it("Should give the collaborator limits of PRs", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      requiredLabelsToStart: PRIORITY_LABELS,
      taskAccessControl: {
        usdPriceMax: {
          collaborator: "Infinity",
          contributor: 1000,
        },
      },
    }) as PluginSettings;
    console.dir([...Value.Errors(pluginSettingsSchema, settings)]);
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    expect(decodedSettings.maxConcurrentTasks["collaborator"]).toEqual(10);
  });
});
