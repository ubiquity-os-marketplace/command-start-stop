import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import { handlePublicStart } from "../src/handlers/start/api/public-api";
import { Env } from "../src/types/env";

const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
const FIRST_ISSUE_URL = "https://github.com/owner/repo/issues/1";

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  drop(db);
  jest.clearAllMocks();
  logSpy.mockClear();
});
afterAll(() => server.close());

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
    },
    orgs: {
      get: jest.fn(),
    },
  },
};

jest.mock("@ubiquity-os/plugin-sdk/octokit", () => ({
  customOctokit: jest.fn(() => mockOctokit),
}));

function createMockEnv(): Env {
  return {
    APP_ID: "123",
    APP_PRIVATE_KEY: "test-key",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_KEY: "test-key",
    BOT_USER_ID: 1,
    LOG_LEVEL: "info",
  };
}

function createMockRequest(body: unknown, method = "POST", jwt?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (jwt) {
    headers.authorization = `Bearer ${jwt}`;
  }

  return new Request("http://localhost:3000/start", {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

describe("handlePublicStart - HTTP Method Validation", () => {
  it("should reject non-POST requests with 405", async () => {
    const request = new Request("https://test.com/start", { method: "GET" });
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);

    expect(response.status).toBe(405);
  });

  it("should accept POST requests", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: FIRST_ISSUE_URL });
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test Issue", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env);

    expect(response.status).not.toBe(405);
  });
});

describe("handlePublicStart - Authentication", () => {
  it("should reject requests without JWT token", async () => {
    const request = createMockRequest({ userId: 123 });
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("Authorization")]),
    });
  });

  it("should verify JWT token with Supabase", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: FIRST_ISSUE_URL }, "POST", "ghu_valid_token");
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env);

    expect(response.status).not.toBe(401);
  });

  it("should reject invalid JWT tokens", async () => {
    const request = createMockRequest({ userId: 123 }, "POST", "invalid_token");
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.ok).toBe(false);
  });
});

describe("handlePublicStart - Request Body Validation", () => {
  it("should reject invalid JSON body", async () => {
    const request = new Request("https://test.com/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json{",
    });
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("JSON")]),
    });
  });

  it("should reject missing userId", async () => {
    const request = createMockRequest({}, "POST", "ghu_valid_token");
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("userId")]),
    });
  });

  it("should validate mode parameter", async () => {
    const request = createMockRequest({ userId: 123, mode: "invalid" }, "POST", "ghu_valid_token");
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
  });
});

describe("handlePublicStart - Rate Limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should enforce rate limits for execute mode (3 requests per minute)", async () => {
    const env = createMockEnv();
    const userId = 456;

    mockOctokit.rest.issues.get.mockResolvedValue({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    // Make 3 successful requests
    for (let i = 0; i < 3; i++) {
      const request = createMockRequest({ userId, issueUrl: FIRST_ISSUE_URL, mode: "execute" }, "POST", "ghu_valid_token");
      const response = await handlePublicStart(request, env);
      expect(response.status).not.toBe(429);
    }

    // 4th request should be rate limited
    const request = createMockRequest({ userId, issueUrl: FIRST_ISSUE_URL, mode: "execute" }, "POST", "ghu_valid_token");
    const response = await handlePublicStart(request, env);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("Rate limit")]),
      resetAt: expect.any(Number),
    });
  });

  it("should enforce higher rate limits for validate mode (10 requests per minute)", async () => {
    const env = createMockEnv();
    const userId = 789;

    mockOctokit.rest.issues.get.mockResolvedValue({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    // Make 10 successful requests
    for (let i = 0; i < 10; i++) {
      const request = createMockRequest({ userId, issueUrl: FIRST_ISSUE_URL, mode: "validate" }, "POST", "ghu_valid_token");
      const response = await handlePublicStart(request, env);
      expect(response.status).not.toBe(429);
    }

    // 11th request should be rate limited
    const request = createMockRequest({ userId, issueUrl: FIRST_ISSUE_URL, mode: "validate" }, "POST", "ghu_valid_token");
    const response = await handlePublicStart(request, env);

    expect(response.status).toBe(429);
  });
});

describe("handlePublicStart - User Access Token Handling", () => {
  it("should accept userAccessToken from request body", async () => {
    const request = createMockRequest(
      {
        userId: 123,
        issueUrl: FIRST_ISSUE_URL,
        userAccessToken: "user-provided-token",
      },
      "POST",
      "ghu_valid_token"
    );
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env);

    expect(response.status).not.toBe(401);
  });

  it("should extract token from user metadata if not provided", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: FIRST_ISSUE_URL }, "POST", "ghu_valid_token");
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env);

    expect(response.status).not.toBe(401);
  });

  it("should return 401 if no access token available", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: FIRST_ISSUE_URL }, "POST", "invalid-jwt");
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("Unauthorized: Invalid JWT, expired, or user not found")]),
    });
  });
});

describe("handlePublicStart - Error Handling", () => {
  it("should return 401 for unauthorized errors", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: FIRST_ISSUE_URL }, "POST", "invalid-jwt");
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockRejectedValueOnce(new Error("Unauthorized") as never);
    const response = await handlePublicStart(request, env);
    expect(response.status).toBe(401);
  });
});
