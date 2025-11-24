// Mock Octokit before other imports
const mockOctokit = {
  rest: {
    users: {
      getAuthenticated: jest.fn(() =>
        Promise.resolve({
          data: { login: "test-user", id: 123 },
        })
      ),
    },
    issues: {
      get: jest.fn(),
      createComment: jest.fn(),
    },
    repos: {
      get: jest.fn(),
      getContent: jest.fn(() =>
        Promise.resolve({
          data: { content: Buffer.from("plugins: []").toString("base64") },
        })
      ),
    },
    orgs: {
      get: jest.fn(),
    },
    apps: {
      listInstallations: jest.fn(() =>
        Promise.resolve({
          data: [{ id: 12345, account: { login: "test-org" } }],
        })
      ),
    },
  },
};

jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn(() => mockOctokit),
}));

jest.mock("../src/handlers/start/api/helpers/get-plugin-config", () => ({
  fetchMergedPluginSettings: jest.fn(() => Promise.resolve({})),
}));

jest.mock("../src/handlers/start/api/helpers/auth", () => ({
  ...jest.requireActual("../src/handlers/start/api/helpers/auth"),
  verifySupabaseJwt: jest.fn(({ jwt }) => {
    if (jwt === "invalid-jwt") {
      return Promise.reject(new Error("Unauthorized: Invalid JWT, expired, or user not found"));
    }
    return Promise.resolve({ id: 123, accessToken: "test-token" });
  }),
}));

import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Context as HonoCtx } from "hono";
import { createLogger } from "../src/handlers/start/api/helpers/context-builder";
import { handlePublicStart } from "../src/handlers/start/api/public-api";
import { Env } from "../src/types/env";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import "./__mocks__/deno-kv";

const ISSUE_ONE_URL = "https://github.com/owner/repo/issues/1";
const INVALID_JWT = "invalid-jwt";
const START_URL = "https://test.com/start";

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  drop(db);
  jest.clearAllMocks();
});
afterAll(() => server.close());

function createMockEnv(): Env {
  return {
    APP_ID: "123",
    APP_PRIVATE_KEY: "test-key",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_KEY: "test-key",
    BOT_USER_ID: 1,
    LOG_LEVEL: "info",
    NODE_ENV: "test",
  };
}

function createMockRequest(
  body: {
    userId?: number;
    issueUrl?: string;
  },
  method = "GET",
  jwt?: string
): HonoCtx {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (jwt) {
    headers.authorization = `Bearer ${jwt}`;
  }

  const queryString = new URLSearchParams(body as Record<string, string>).toString();
  const requestInit: RequestInit = {
    method,
    headers,
  };

  const request = new Request(START_URL + "?" + queryString, requestInit);
  return {
    env: createMockEnv(),
    req: {
      raw: request,
      json: () => request.json(),
    },
    header: (name: string) => request.headers.get(name) || undefined,
  } as unknown as HonoCtx;
}

describe("handlePublicStart - HTTP Method Validation", () => {
  it("should reject non-GET/POST requests with 405", async () => {
    const env = createMockEnv();
    const request = {
      req: {
        raw: new Request(START_URL, { method: "DELETE" }),
      },
      env,
    } as unknown as HonoCtx;
    const response = await handlePublicStart(request, env, createLogger(env));

    expect(response.status).toBe(405);
  });

  it("should accept GET requests", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", "ghu_valid_token");
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test Issue", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env, createLogger(env));

    expect(response.status).not.toBe(405);
  });

  it("should accept POST requests", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "POST", "ghu_valid_token");
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test Issue", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env, createLogger(env));

    expect(response.status).not.toBe(405);
  });
});

describe("handlePublicStart - Authentication", () => {
  it("should reject requests without JWT token", async () => {
    const request = createMockRequest({ userId: 123 });
    const env = createMockEnv();

    const response = await handlePublicStart(request, env, createLogger(env));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("Authorization")]),
    });
  });

  it("should verify JWT token with Supabase", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", "ghu_valid_token");
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env, createLogger(env));

    expect(response.status).not.toBe(401);
  });

  it("should reject invalid JWT tokens", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", INVALID_JWT);
    const env = createMockEnv();

    const response = await handlePublicStart(request, env, createLogger(env));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.ok).toBe(false);
  });
});

describe("handlePublicStart - Request Query Validation", () => {
  it("should reject invalid query parameters", async () => {
    const env = createMockEnv();
    const queryString = new URLSearchParams({
      userId: "123",
      issueUrl: ISSUE_ONE_URL,
      badKey: "badValue",
    }).toString();
    const request = {
      req: {
        raw: new Request(START_URL + "?" + queryString, {
          method: "GET",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer ghu_valid_token",
          },
        }),
      },
    } as unknown as HonoCtx;

    const response = await handlePublicStart(request, env, createLogger(env));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("JSON")]),
    });
  });

  it("should reject missing userId", async () => {
    const request = createMockRequest({}, "GET", "ghu_valid_token");
    const env = createMockEnv();

    const response = await handlePublicStart(request, env, createLogger(env));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("userId")]),
    });
  });
});

// describe("handlePublicStart - Rate Limiting", () => {
//   beforeEach(() => {
//     jest.clearAllMocks();
//     // Reset the in-memory KV store to ensure clean state between tests
//     resetInMemoryKvStore();
//   });

//   afterEach(() => {
//     // Also reset after each test to ensure clean state
//     resetInMemoryKvStore();
//   });

//   it("should enforce rate limits for execute mode (3 requests per minute)", async () => {
//     const userId = 456;
//     const env = createMockEnv();
//     process.env = env as unknown as NodeJS.ProcessEnv;
//     // Ensure clean state before importing worker
//     resetInMemoryKvStore();

//     mockOctokit.rest.issues.get.mockResolvedValue({
//       data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
//     } as never);
//     mockOctokit.rest.repos.get.mockResolvedValue({
//       data: { id: 1, name: "repo", owner: { login: "owner" } },
//     } as never);

//     // Helper to create a POST request with JSON body
//     function createPostRequest(body: Record<string, unknown>, jwt?: string, ip = "127.0.0.1") {
//       const headers: Record<string, string> = {
//         "content-type": "application/json",
//         "cf-connecting-ip": ip, // Use header for IP
//       };
//       if (jwt) headers["authorization"] = `Bearer ${jwt}`;
//       const requestInit: RequestInit = {
//         method: "POST",
//         headers,
//         body: JSON.stringify(body),
//       };
//       return new Request(BASE_URL + "/start", requestInit);
//     }

//     // Use unique IP for this test to avoid middleware rate limiter interference
//     const testIp = `127.0.0.${userId}`;

//     for (let i = 0; i < 3; i++) {
//       const request = createPostRequest({ userId, issueUrl: ISSUE_ONE_URL }, "ghu_valid_token", testIp);
//       const response = await worker.fetch(request, env);
//       expect(response.status).not.toBe(429);
//     }

//     // 4th request should be rate limited
//     const request = createPostRequest({ userId, issueUrl: ISSUE_ONE_URL }, "ghu_valid_token", testIp);
//     const response = await worker.fetch(request, env);
//     const data = await response.json();

//     expect(response.status).toBe(429);
//     expect(data).toMatchObject({
//       ok: false,
//       reasons: expect.arrayContaining([expect.stringContaining("RateLimit: exceeded")]),
//       resetAt: expect.any(Number),
//     });
//   });

//   it("should enforce higher rate limits for validate mode (10 requests per minute)", async () => {
//     const userId = 678;
//     const env = createMockEnv();
//     process.env = env as unknown as NodeJS.ProcessEnv;
//     resetInMemoryKvStore();

//     // MSW handlers will handle Supabase auth automatically
//     mockOctokit.rest.issues.get.mockResolvedValue({
//       data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
//     } as never);
//     mockOctokit.rest.repos.get.mockResolvedValue({
//       data: { id: 1, name: "repo", owner: { login: "owner" } },
//     } as never);

//     // Helper to create a GET request
//     function createGetRequest(body: Record<string, unknown>, jwt?: string, ip = "127.0.0.1") {
//       const headers: Record<string, string> = {
//         "content-type": "application/json",
//         "cf-connecting-ip": ip, // Use header for IP
//       };
//       if (jwt) headers["authorization"] = `Bearer ${jwt}`;
//       const queryString = new URLSearchParams(body as Record<string, string>).toString();
//       return new Request(BASE_URL + "/start" + "?" + queryString, {
//         method: "GET",
//         headers,
//       });
//     }

//     // Use unique IP for this test to avoid middleware rate limiter interference
//     const testIp = `127.0.0.${userId}`;

//     // Make 10 successful requests
//     for (let i = 0; i < 10; i++) {
//       const request = createGetRequest({ userId, issueUrl: ISSUE_ONE_URL }, "ghu_valid_token", testIp);
//       const response = await worker.fetch(request, env);
//       // Requests should succeed (not be rate limited or auth failed)
//       expect(response.status).not.toBe(429);
//       expect(response.status).not.toBe(401);
//     }

//     // 11th request should be rate limited
//     const request = createGetRequest({ userId, issueUrl: ISSUE_ONE_URL }, "ghu_valid_token", testIp);
//     const response = await worker.fetch(request, env);

//     expect(response.status).toBe(429);
//   });
// });

describe("handlePublicStart - User Access Token Handling", () => {
  it("should accept userAccessToken from request body", async () => {
    const request = createMockRequest(
      {
        userId: 123,
        issueUrl: ISSUE_ONE_URL,
      },
      "GET",
      "ghu_valid_token"
    );
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env, createLogger(env));

    expect(response.status).not.toBe(401);
  });

  it("should extract token from user metadata if not provided", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", "ghu_valid_token");
    const env = createMockEnv();

    // MSW handler returns user with metadata containing access_token
    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env, createLogger(env));

    expect(response.status).not.toBe(401);
  });

  it("should return 401 if no access token available", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", INVALID_JWT);
    const env = createMockEnv();

    const response = await handlePublicStart(request, env, createLogger(env));
    const data = await response.json();

    console.log("Response Data:", data);
    expect(response.status).toBe(401);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("Unauthorized: Invalid JWT, expired, or user not found")]),
    });
  });
});

describe("handlePublicStart - Error Handling", () => {
  it("should return 401 for unauthorized errors", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", INVALID_JWT);
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockRejectedValueOnce(new Error("Unauthorized") as never);
    const response = await handlePublicStart(request, env, createLogger(env));
    expect(response.status).toBe(401);
  });
});
