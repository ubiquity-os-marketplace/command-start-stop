import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Context as HonoCtx } from "hono";
import { handlePublicStart } from "../src/handlers/start/api/public-api";
import { Env } from "../src/types/env";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";

const ISSUE_ONE_URL = "https://github.com/owner/repo/issues/1";
const INVALID_JWT = "invalid-jwt";
const START_URL = "https://test.com/start";
const BASE_URL = "https://test.com";

// Mock KV store for testing
function createMockKvStore() {
  const store = new Map<string, { value: unknown; expireAt?: number }>();

  return {
    get: jest.fn(async <T>(key: string[]) => {
      const keyStr = JSON.stringify(key);
      const entry = store.get(keyStr);
      if (!entry) return { value: null };
      if (entry.expireAt && entry.expireAt < Date.now()) {
        store.delete(keyStr);
        return { value: null };
      }
      return { value: entry.value as T };
    }),
    set: jest.fn(async <T>(key: string[], value: T, options?: { expireIn?: number }) => {
      const keyStr = JSON.stringify(key);
      const expireAt = options?.expireIn ? Date.now() + options.expireIn * 1000 : undefined;
      store.set(keyStr, { value, expireAt });
    }),
    delete: jest.fn(async (key: string[]) => {
      const keyStr = JSON.stringify(key);
      store.delete(keyStr);
    }),
    clear: () => store.clear(),
  };
}

// Mock getConnInfo to control IP addresses
// It reads from request headers (cf-connecting-ip, x-forwarded-for, x-real-ip) or a stored _testIp property
jest.mock("hono/deno", () => ({
  getConnInfo: jest.fn((c: unknown) => {
    const ctx = c as { req?: { raw?: Request; header?: (name: string) => string | undefined }; _testIp?: string };
    const request = ctx?.req?.raw;
    if (request) {
      // Check for stored test IP first
      const testIp = (request as unknown as { _testIp?: string })?._testIp;
      if (testIp) {
        return { remote: { address: testIp } };
      }
      // Check headers
      const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
      if (ip) {
        return { remote: { address: ip } };
      }
    }
    return { remote: { address: "127.0.0.1" } };
  }),
}));

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  drop(db);
  jest.clearAllMocks();
  if (mockKvStore) {
    mockKvStore.clear();
  }
});
afterAll(() => server.close());

// Mock Octokit for GitHub API calls
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

let mockKvStore: ReturnType<typeof createMockKvStore>;

function createMockEnv(): Env {
  if (!mockKvStore) {
    mockKvStore = createMockKvStore();
  }
  return {
    APP_ID: "123",
    APP_PRIVATE_KEY: "test-key",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_KEY: "test-key",
    BOT_USER_ID: 1,
    LOG_LEVEL: "info",
    NODE_ENV: "test",
    RATE_LIMIT_KV: mockKvStore as unknown as Env["RATE_LIMIT_KV"],
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
    const response = await handlePublicStart(request, env);

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

    const response = await handlePublicStart(request, env);

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
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", "ghu_valid_token");
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
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", INVALID_JWT);
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);
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

    const response = await handlePublicStart(request, env);
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

    const response = await handlePublicStart(request, env);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("userId")]),
    });
  });
});

describe("handlePublicStart - Rate Limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (mockKvStore) {
      mockKvStore.clear();
    }
  });

  it("should enforce rate limits for execute mode (3 requests per minute)", async () => {
    const userId = 456;
    const env = createMockEnv();
    process.env = env as unknown as NodeJS.ProcessEnv;
    const worker = (await import("../src/worker")).default;

    mockOctokit.rest.issues.get.mockResolvedValue({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    // Helper to create a POST request with JSON body
    function createPostRequest(body: Record<string, unknown>, jwt?: string, ip = "127.0.0.1") {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "cf-connecting-ip": ip, // Use header for IP
      };
      if (jwt) headers["authorization"] = `Bearer ${jwt}`;
      const requestInit: RequestInit = {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      };
      return new Request(BASE_URL + "/start", requestInit);
    }

    // Use unique IP for this test to avoid middleware rate limiter interference
    const testIp = `127.0.0.${userId}`;

    for (let i = 0; i < 3; i++) {
      const request = createPostRequest({ userId, issueUrl: ISSUE_ONE_URL }, "ghu_valid_token", testIp);
      const response = await worker.fetch(request, env);
      expect(response.status).not.toBe(429);
    }

    // 4th request should be rate limited
    const request = createPostRequest({ userId, issueUrl: ISSUE_ONE_URL }, "ghu_valid_token", testIp);
    const response = await worker.fetch(request, env);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([expect.stringContaining("RateLimit: exceeded")]),
      resetAt: expect.any(Number),
    });
  });

  it("should enforce higher rate limits for validate mode (10 requests per minute)", async () => {
    const userId = 678;
    const env = createMockEnv();
    process.env = env as unknown as NodeJS.ProcessEnv;
    const worker = (await import("../src/worker")).default;

    // MSW handlers will handle Supabase auth automatically
    mockOctokit.rest.issues.get.mockResolvedValue({
      data: { number: 1, title: "Test", state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    // Helper to create a GET request
    function createGetRequest(body: Record<string, unknown>, jwt?: string, ip = "127.0.0.1") {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "cf-connecting-ip": ip, // Use header for IP
      };
      if (jwt) headers["authorization"] = `Bearer ${jwt}`;
      const queryString = new URLSearchParams(body as Record<string, string>).toString();
      return new Request(BASE_URL + "/start" + "?" + queryString, {
        method: "GET",
        headers,
      });
    }

    // Use unique IP for this test to avoid middleware rate limiter interference
    const testIp = `127.0.0.${userId}`;

    // Make 10 successful requests
    for (let i = 0; i < 10; i++) {
      const request = createGetRequest({ userId, issueUrl: ISSUE_ONE_URL }, "ghu_valid_token", testIp);
      const response = await worker.fetch(request, env);
      // Requests should succeed (not be rate limited or auth failed)
      expect(response.status).not.toBe(429);
      expect(response.status).not.toBe(401);
    }

    // 11th request should be rate limited
    const request = createGetRequest({ userId, issueUrl: ISSUE_ONE_URL }, "ghu_valid_token", testIp);
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(429);
  });
});

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

    const response = await handlePublicStart(request, env);

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

    const response = await handlePublicStart(request, env);

    expect(response.status).not.toBe(401);
  });

  it("should return 401 if no access token available", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", INVALID_JWT);
    const env = createMockEnv();

    const response = await handlePublicStart(request, env);
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
    const response = await handlePublicStart(request, env);
    expect(response.status).toBe(401);
  });
});
