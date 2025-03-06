import { Value } from "@sinclair/typebox/value";
import { pluginSettingsSchema } from "../src/types";

describe("pluginSettingsSchema default values", () => {
    it("should return the correct default values", () => {
        const defaultValues = Value.Default(pluginSettingsSchema, {});

        expect(defaultValues).toEqual({
            reviewDelayTolerance: "1 Day",
            taskStaleTimeoutDuration: "30 Days",
            startRequiresWallet: true,
            maxConcurrentTasks: {
                collaborator: 10,
                contributor: 2,
            },
            assignedIssueScope: "org",
            emptyWalletText: "Please set your wallet address with the /wallet command first and try again.",
            rolesWithReviewAuthority: ["OWNER", "ADMIN", "MEMBER", "COLLABORATOR"],
            requiredLabelsToStart: [],
            taskAccessControl: {
                priceMaxUSD: {
                    collaborator: 10000,
                    admin: 10000,
                    contributor: 200,
                },
            },
        });
    });
});