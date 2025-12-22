import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Context as HonoCtx } from "hono";
import { http, HttpResponse } from "msw";
import { createLogger, getDefaultConfig } from "../src/handlers/start/api/helpers/context-builder";
import { Env } from "../src/types/env";
import { AssignedIssueScope } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import "./__mocks__/deno-kv";
import { server } from "./__mocks__/node";

type HandlePublicStart = typeof import("../src/handlers/start/api/public-api").handlePublicStart;
let handlePublicStart!: HandlePublicStart;

// Mock Octokit before other imports
const mockOctokit = {
  paginate: jest.fn(),
  users: {
    getAuthenticated: jest.fn(() =>
      Promise.resolve({
        data: { login: "test-user", id: 123 },
      })
    ),
  },
  rest: {
    users: {
      getById: jest.fn(() =>
        Promise.resolve({
          data: { login: "test-user", id: 123 },
        })
      ),
      getByUsername: jest.fn(({ username }) =>
        Promise.resolve({
          data: { login: username, id: 123 },
        })
      ),
      getAuthenticated: jest.fn(() =>
        Promise.resolve({
          data: { login: "test-user", id: 123 },
        })
      ),
      getByUsername: jest.fn(),
    },
    issues: {
      get: jest.fn(),
      createComment: jest.fn(),
      listEvents: jest.fn(),
      listComments: jest.fn(),
      listForRepo: jest.fn(),
    },
    repos: {
      get: jest.fn(),
      getContent: jest.fn(() =>
        Promise.resolve({
          data: { content: Buffer.from("plugins: []").toString("base64") },
        })
      ),
      listForOrg: jest.fn(),
      listForUser: jest.fn(),
      getCollaboratorPermissionLevel: jest.fn(),
    },
    orgs: {
      get: jest.fn(),
      getMembershipForUser: jest.fn(),
    },
    search: {
      issuesAndPullRequests: jest.fn(),
    },
    pulls: {
      listReviews: jest.fn(),
    },
    apps: {
      listInstallations: jest.fn(() =>
        Promise.resolve({
          data: [{ id: 12345, account: { login: "test-org" } }],
        })
      ),
      getRepoInstallation: jest.fn(),
    },
  },
};

jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn(() => mockOctokit),
}));

jest.mock(
  "@octokit/webhooks-methods",
  () => ({
    sign: jest.fn(),
    verify: jest.fn(),
    signWithOptions: jest.fn(),
    verifyWithOptions: jest.fn(),
    signPayloadWithEncoding: jest.fn(),
    verifyPayloadWithEncoding: jest.fn(),
  }),
  { virtual: true }
);

jest.mock("../src/handlers/start/api/helpers/get-plugin-config", () => ({
  fetchMergedPluginSettings: jest.fn(() => Promise.resolve({})),
}));

const mockGetUserRoleAndTaskLimit = jest.fn();
jest.mock("../src/utils/get-user-task-limit-and-role", () => ({
  getUserRoleAndTaskLimit: (...args: unknown[]) => mockGetUserRoleAndTaskLimit(...args),
}));

const mockGetAssignmentPeriods = jest.fn();
jest.mock("../src/utils/get-assignment-periods", () => ({
  getAssignmentPeriods: (...args: unknown[]) => mockGetAssignmentPeriods(...args),
}));

jest.mock("../src/utils/issue", () => {
  const actual = jest.requireActual("../src/utils/issue");
  return {
    ...(actual as object),
    getPendingOpenedPullRequests: jest.fn(async () => []),
  };
});

jest.mock("../src/handlers/start/api/helpers/auth", () => ({
  ...(jest.requireActual("../src/handlers/start/api/helpers/auth") as object),
  verifySupabaseJwt: jest.fn(({ jwt }) => {
    if (jwt === "invalid-jwt") {
      return Promise.reject(new Error("Unauthorized: Invalid JWT, expired, or user not found"));
    }
    return Promise.resolve({ id: 123, accessToken: "test-token" });
  }),
}));

const ISSUE_ONE_URL = "https://github.com/owner/repo/issues/1";
const INVALID_JWT = "invalid-jwt";
const START_URL = "https://test.com/start";
const TEST_ISSUE_TITLE = "Test Issue";
const PRICE_LABEL = "Price: 100";
const GITHUB_VALID_TOKEN = "ghu_valid_token";
const USER_WHILEFOO = "whilefoo";

beforeAll(async () => {
  ({ handlePublicStart } = await import("../src/handlers/start/api/public-api"));
  server.listen();
});
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
    userId?: number | string;
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
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", GITHUB_VALID_TOKEN);
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: TEST_ISSUE_TITLE, state: "open", assignees: [], labels: [] },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: { id: 1, name: "repo", owner: { login: "owner" } },
    } as never);

    const response = await handlePublicStart(request, env, createLogger(env));

    expect(response.status).not.toBe(405);
  });

  it("should accept POST requests", async () => {
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "POST", GITHUB_VALID_TOKEN);
    const env = createMockEnv();

    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: TEST_ISSUE_TITLE, state: "open", assignees: [], labels: [] },
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
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", "sb_valid_token");
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
            authorization: "Bearer sb_valid_token",
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
    const request = createMockRequest({}, "GET", "sb_valid_token");
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
      "sb_valid_token"
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
    const request = createMockRequest({ userId: 123, issueUrl: ISSUE_ONE_URL }, "GET", "sb_valid_token");
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

describe("handlePublicStart - Assigned issue filtering", () => {
  it(`omits archived assigned issues for ${USER_WHILEFOO}`, async () => {
    const env = createMockEnv();
    const request = createMockRequest({ userId: USER_WHILEFOO, issueUrl: ISSUE_ONE_URL }, "GET", GITHUB_VALID_TOKEN);
    server.use(
      http.get("https://api.github.com/user", () =>
        HttpResponse.json({ login: USER_WHILEFOO, id: 42, created_at: new Date().toISOString(), type: "User", site_admin: false })
      ),
      http.get("https://api.github.com/repos/:owner/:repo", ({ params: { owner, repo } }) =>
        HttpResponse.json({
          id: 1,
          name: repo,
          full_name: `${owner}/${repo}`,
          owner: { login: owner, id: 7, type: "Organization" },
          organization: { login: owner },
          html_url: `https://github.com/${owner}/${repo}`,
        })
      ),
      http.get("https://api.github.com/repos/:owner/:repo/issues/:issue_number", () =>
        HttpResponse.json({
          id: 1,
          number: 1,
          title: TEST_ISSUE_TITLE,
          assignees: [],
          html_url: ISSUE_ONE_URL,
          state: "open",
          labels: [{ name: PRICE_LABEL }],
          body: null,
          repository_url: "https://api.github.com/repos/owner/repo",
          user: { login: "owner" },
        })
      ),
      http.get("https://api.github.com/search/issues", () =>
        HttpResponse.json({
          items: [
            {
              html_url: "https://github.com/owner/archived-repo/issues/99",
              title: "Archived Issue",
              assignee: { login: USER_WHILEFOO },
              assignees: [{ login: USER_WHILEFOO }],
              repository: { archived: true },
            },
          ],
          total_count: 1,
        })
      )
    );
    mockGetUserRoleAndTaskLimit.mockResolvedValue({ role: "admin", limit: Infinity } as never);
    mockGetAssignmentPeriods.mockResolvedValue({} as never);
    db.repo.create({
      id: 1,
      html_url: ISSUE_ONE_URL,
      name: "repo",
      full_name: "owner/repo",
      owner: { login: "owner", id: 7, type: "Organization" },
      issues: [],
    });
    db.issue.create({
      id: 1,
      assignees: [],
      html_url: ISSUE_ONE_URL,
      repository_url: "https://api.github.com/repos/owner/repo",
      state: "open",
      owner: "owner",
      repo: "repo",
      labels: [{ name: PRICE_LABEL }],
      author_association: "CONTRIBUTOR",
      body: null,
      closed_at: null,
      created_at: new Date().toISOString(),
      comments: 0,
      comments_url: "https://api.github.com/repos/owner/repo/issues/1/comments",
      events_url: "https://api.github.com/repos/owner/repo/issues/1/events",
      labels_url: "https://api.github.com/repos/owner/repo/issues/1/labels{/name}",
      locked: false,
      node_id: "MDU6SXNzdWUx",
      title: TEST_ISSUE_TITLE,
      number: 1,
      updated_at: new Date().toISOString(),
      url: ISSUE_ONE_URL,
      user: null,
      milestone: null,
      assignee: null,
    });
    db.users.create({ id: 42, login: USER_WHILEFOO, role: "admin", created_at: new Date().toISOString(), xp: 0, wallet: null });
    const pluginConfigMock = (await import("../src/handlers/start/api/helpers/get-plugin-config")).fetchMergedPluginSettings as jest.Mock;
    pluginConfigMock.mockResolvedValueOnce({ ...getDefaultConfig(), assignedIssueScope: AssignedIssueScope.ORG } as never);

    mockOctokit.users.getAuthenticated.mockResolvedValueOnce({ data: { login: USER_WHILEFOO, id: 42 } } as never);
    mockOctokit.rest.users.getAuthenticated.mockResolvedValueOnce({ data: { login: USER_WHILEFOO, id: 42 } } as never);
    mockOctokit.rest.users.getByUsername.mockResolvedValueOnce({ data: { id: 42, login: USER_WHILEFOO, type: "User" } } as never);
    mockOctokit.rest.users.getByUsername.mockResolvedValueOnce({ data: { id: 7, login: "owner", type: "Organization" } } as never);
    mockOctokit.rest.issues.get.mockResolvedValueOnce({
      data: { number: 1, title: TEST_ISSUE_TITLE, state: "open", assignees: [], labels: [{ name: PRICE_LABEL }], body: "", html_url: ISSUE_ONE_URL },
    } as never);
    mockOctokit.rest.repos.get.mockResolvedValueOnce({ data: { id: 1, name: "repo", owner: { login: "owner" }, organization: { login: "owner" } } } as never);
    mockOctokit.rest.orgs.getMembershipForUser.mockResolvedValueOnce({ data: { role: "admin" } } as never);
    mockOctokit.paginate.mockImplementation((arg, params) => {
      if (params && typeof params === "object" && "q" in params) {
        const query = (params as { q?: string }).q || "";
        if (query.includes(`assignee:${USER_WHILEFOO}`)) {
          return Promise.resolve([
            {
              html_url: "https://github.com/owner/archived-repo/issues/99",
              title: "Archived Issue",
              assignee: { login: USER_WHILEFOO },
              assignees: [{ login: USER_WHILEFOO }],
              repository: { archived: true },
            },
          ]);
        }
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const response = await handlePublicStart(request, env, createLogger(env));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.computed.assignedIssues).toEqual([]);
  });
});
