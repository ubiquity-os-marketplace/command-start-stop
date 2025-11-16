import { describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";

import { Context } from "../src/types";
import { getUserRoleAndTaskLimit } from "../src/utils/get-user-task-limit-and-role";

describe("Role tests", () => {
  it("Should retrieve the user role from organization", async () => {
    const maxConcurrentTasks = {
      collaborator: 2,
      contributor: 1,
    };
    const ctx = {
      payload: {
        organization: {
          login: "ubiquity-os-marketplace",
        },
        repository: {
          owner: {
            login: "ubiquity-os-marketplace",
          },
          name: "command-start-stop",
        },
      },
      config: {
        maxConcurrentTasks,
      },
      logger: new Logs("debug"),
      octokit: {
        rest: {
          orgs: {
            getMembershipForUser: jest.fn(() => ({ data: { role: "admin" } })),
          },
        },
      },
    } as unknown as Context;

    let result = await getUserRoleAndTaskLimit(ctx, "ubiquity-os");
    expect(result).toEqual({ limit: Infinity, role: "admin" });
    ctx.octokit = {
      rest: {
        repos: {
          getCollaboratorPermissionLevel: jest.fn(() => ({ data: { role_name: "contributor" } })),
        },
      },
    } as unknown as Context["octokit"];
    result = await getUserRoleAndTaskLimit(ctx, "ubiquity-os");
    expect(result).toEqual({ limit: 1, role: "contributor" });
  });
});
