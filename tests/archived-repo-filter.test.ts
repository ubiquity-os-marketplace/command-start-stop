import { describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Context } from "../src/types/context";
import { AssignedIssueScope } from "../src/types/plugin-input";
import { getAllPullRequestsFallback } from "../src/utils/get-pull-requests-fallback";
import { getAllPullRequestsWithRetry } from "../src/utils/issue";

describe("Archived repository filtering", () => {
  it("adds `archived:false` to the PR search query", async () => {
    const paginate = jest.fn(async () => []);
    const issuesAndPullRequests = jest.fn();

    const octokit = {
      paginate,
      rest: {
        search: {
          issuesAndPullRequests,
        },
      },
    } as unknown as Context["octokit"];

    const context = {
      config: { assignedIssueScope: AssignedIssueScope.ORG },
      organizations: ["ubiquity-os-marketplace"],
      payload: {
        repository: {
          full_name: "ubiquity-os-marketplace/command-start-stop",
          owner: { login: "ubiquity-os-marketplace" },
        },
      },
      octokit,
      logger: new Logs("debug"),
    } as unknown as Context;

    await getAllPullRequestsWithRetry(context, "open", "some-user");

    expect(paginate).toHaveBeenCalledTimes(1);
    const query = (paginate as unknown as jest.Mock).mock.calls[0][1] as { q: string };
    expect(query.q).toContain("archived:false");
    expect(query.q).toContain("is:pr");
  });

  it("skips archived repositories in fallback PR enumeration", async () => {
    const repos = [
      { name: "archived-repo", archived: true, url: "https://api.github.com/repos/acme/archived-repo" },
      { name: "active-repo", archived: false, url: "https://api.github.com/repos/acme/active-repo" },
    ];

    const pulls = [
      { id: 1, user: { login: "some-user" } },
      { id: 2, user: { login: "other-user" } },
    ];

    const listForOrg = jest.fn();
    const listForUser = jest.fn();
    const getByUsername = jest.fn(async () => ({ data: { type: "Organization" } }));
    const pullsList = jest.fn();

    const paginate = jest.fn(async (endpoint: unknown, params: { repo?: string }) => {
      if (endpoint === listForOrg) {
        return repos;
      }

      if (endpoint === pullsList) {
        if (params.repo === "archived-repo") {
          throw new Error("should not query archived repo");
        }
        return pulls;
      }

      return [];
    });

    const octokit = {
      paginate,
      rest: {
        pulls: {
          list: pullsList,
        },
        repos: {
          listForOrg,
          listForUser,
        },
        users: {
          getByUsername,
        },
      },
    } as unknown as Context["octokit"];

    const context = {
      payload: {
        repository: {
          owner: { login: "acme" },
        },
      },
      octokit,
      logger: new Logs("debug"),
    } as unknown as Context;

    const result = await getAllPullRequestsFallback(context, "open", "some-user");

    expect(result).toHaveLength(1);
    expect(paginate).toHaveBeenCalledWith(pullsList, expect.objectContaining({ repo: "active-repo" }));
  });
});
