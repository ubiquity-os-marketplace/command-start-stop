import { RestEndpointMethodTypes } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Context } from "../src/types/context";
import { getAllPullRequestsWithRetry } from "../src/utils/issue";

const username = "private-user";

const mockPullRequestData = [
  { id: 1, number: 123, state: "open", user: { login: username } },
  { id: 2, number: 124, state: "open", user: { login: "public-user" } },
] as unknown as RestEndpointMethodTypes["pulls"]["list"]["response"]["data"];

const mockOctokit = {
  paginate: jest.fn().mockResolvedValue(mockPullRequestData),
  rest: {
    pulls: {
      list: jest.fn().mockResolvedValue(mockPullRequestData),
    },
    repos: {
      listForOrg: jest.fn().mockResolvedValue(mockPullRequestData),
    },
  },
};

const context: Context = {
  eventName: "pull_request",
  payload: {
    repository: {
      name: "test-repo",
      owner: {
        login: "test-owner",
      },
    },
  },
  octokit: mockOctokit as unknown as Context["octokit"],
  logger: new Logs("debug"),
  adapters: {},
} as unknown as Context;

describe("getAllPullRequestsWithRetry", () => {
  it("should return pull requests even if user information is private", async () => {
    const pullRequests = await getAllPullRequestsWithRetry(context, "all", username);
    expect(pullRequests).toHaveLength(2);
    expect(pullRequests[0].user?.login).toBe(username);
    expect(pullRequests[1].user?.login).toBe(username);
    console.log(pullRequests);
  });
});
