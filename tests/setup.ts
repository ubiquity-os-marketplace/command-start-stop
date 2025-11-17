import { jest } from "@jest/globals";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";

// jest.mock("@ubiquity-os/plugin-sdk/octokit", () => {
//     const actual = jest.requireActual<typeof import("@ubiquity-os/plugin-sdk/octokit")>("@ubiquity-os/plugin-sdk/octokit");
//     return {
//         ...actual,
//         customOctokit: jest.fn(() => {
//             return new actual.customOctokit({ auth: "mock-token" });
//         })
//     };
// });

jest.mock("@ubiquity-os/plugin-sdk", () => {
  const actual = jest.requireActual<typeof import("@ubiquity-os/plugin-sdk")>("@ubiquity-os/plugin-sdk");
  return {
    ...actual,
    CommentHandler: jest.fn().mockImplementation(() => {
      return {
        postComment: jest.fn(),
      };
    }),
  };
});

export const mockOctokit = new customOctokit({ auth: "mock-token" });

jest.mock("@octokit/core", () => ({
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
