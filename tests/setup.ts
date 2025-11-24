import { jest } from "@jest/globals";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import "./__mocks__/deno-kv";
export const mockOctokit = new customOctokit({ auth: "mock-token" });

jest.mock("@ubiquity-os/plugin-sdk", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Hono } = require("hono");
  return {
    CommentHandler: jest.fn().mockImplementation(() => {
      return {
        postComment: jest.fn(),
      };
    }),
    createPlugin: jest.fn(() => {
      return new Hono();
    }),
  };
});

jest.mock("@octokit/core", () => ({
  Octokit: jest.fn(() => mockOctokit),
}));

jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn(() => mockOctokit),
}));

jest.mock("../src/handlers/start/api/helpers/octokit", () => ({
  createUserOctokit: jest.fn(() => mockOctokit),
  createAppOctokit: jest.fn(() => mockOctokit),
  createRepoOctokit: jest.fn(() => mockOctokit),
}));

jest.mock("@octokit/plugin-rest-endpoint-methods", () => ({}));

jest.mock("@octokit/auth-app", () => ({
  createAppAuth: jest.fn(() => async () => ({ token: "mock-token" })),
}));
