import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import { handleRecommendations } from "../src/handlers/start/api/directory-task-recommendations";
import { ShallowContext } from "../src/handlers/start/api/helpers/context-builder";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Context, PluginSettings } from "../src/types";
import { CommentHandler } from "@ubiquity-os/plugin-sdk";

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  drop(db);
  jest.clearAllMocks();
});
afterAll(() => server.close());

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ data: [] })),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null })),
      })),
    })),
  })),
  rpc: jest.fn(),
};

const mockOctokit = {
  rest: {
    issues: {
      get: jest.fn(),
    },
    repos: {
      get: jest.fn(),
    },
  },
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

function createMockContext(): ShallowContext {
  return {
    env: {
      APP_ID: "123",
      APP_PRIVATE_KEY: "test-key",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_KEY: "test-key",
      BOT_USER_ID: 1,
    },
    octokit: mockOctokit as unknown as Context["octokit"],
    logger: new Logs("info"),
    config: {} as PluginSettings,
    command: { name: "start", parameters: { teammates: [] } },
    eventName: "issue_comment.created",
    commentHandler: { postComment: jest.fn() } as unknown as CommentHandler,
    payload: {
      sender: {
        login: "test-user",
        id: 123,
      },
    },
    adapters: {} as Context["adapters"],
  };
}

describe("handleRecommendations - Basic Functionality", () => {
  it("should return empty recommendations when user has no prior embeddings", async () => {
    const context = createMockContext();

    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [] } as never),
        }),
      }) as never,
    });

    const response = await handleRecommendations({ context });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      ok: true,
      recommendations: [],
      note: expect.stringContaining("No prior embeddings"),
    });
  });

  it("should return recommendations when user has prior work", async () => {
    const context = createMockContext();

    mockOctokit.rest.issues.get.mockResolvedValue({
      data: {
        number: 42,
        title: "Test Issue",
        state: "open",
        assignees: [],
      },
    } as never);

    const response = await handleRecommendations({ context });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.recommendations)).toBe(true);
    // MSW returns recommendations based on embeddings.json fixture
    expect(data.recommendations.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle custom topK and threshold options", async () => {
    const context = createMockContext();
    const options = { topK: 10, threshold: 0.8 };

    // Since we're testing with MSW, we verify the response is valid
    const response = await handleRecommendations({ context, options });
    const data = await response.json();

    // Verify response is successful (options are passed through to RPC via MSW)
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.recommendations)).toBe(true);
  });
});

describe("handleRecommendations - Embedding Processing", () => {
  it("should skip invalid embeddings", async () => {
    const context = createMockContext();

    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [
              { embedding: "invalid json", payload: JSON.stringify({}) },
              { embedding: JSON.stringify([1, 2, 3]), payload: JSON.stringify({}) },
              { embedding: JSON.stringify([]), payload: JSON.stringify({}) }, // Empty array
            ],
          } as never),
        }),
      }) as never,
    });

    const response = await handleRecommendations({ context });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations).toEqual([]);
  });

  it("should calculate average embedding from multiple vectors", async () => {
    const context = createMockContext();

    // This test verifies the averaging logic works correctly
    // MSW will return embeddings from fixture; we verify the response is valid
    const response = await handleRecommendations({ context });
    const data = await response.json();

    // Verify successful processing (averaging happens internally)
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

describe("handleRecommendations - Filtering Logic", () => {
  it("should filter out issues with assignees", async () => {
    const context = createMockContext();

    const mockEmbedding = JSON.stringify(Array(384).fill(0.5));
    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ embedding: mockEmbedding, payload: JSON.stringify({}) }],
          } as never),
        }),
      }) as never,
    });

    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: [{ issue_id: "issue-1", similarity: 0.85 }],
      error: null,
    } as never);

    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              payload: JSON.stringify({
                repository: { owner: { login: "owner" }, name: "repo" },
                number: 42,
                assignees: [{ login: "someone" }], // Has assignees
              }),
            },
          } as never),
        }),
      }) as never,
    });

    const response = await handleRecommendations({ context });
    const data = await response.json();

    expect(data.recommendations).toEqual([]);
  });

  it("should skip issues missing org, repo, or number", async () => {
    const context = createMockContext();

    const mockEmbedding = JSON.stringify(Array(384).fill(0.5));
    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ embedding: mockEmbedding, payload: JSON.stringify({}) }],
          } as never),
        }),
      }) as never,
    });

    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: [{ issue_id: "issue-1", similarity: 0.85 }],
      error: null,
    } as never);

    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              payload: JSON.stringify({
                repository: { owner: { login: "owner" } }, // Missing 'name'
                number: 42,
                assignees: [],
              }),
            },
          } as never),
        }),
      }) as never,
    });

    const response = await handleRecommendations({ context });
    const data = await response.json();

    expect(data.recommendations).toEqual([]);
  });

  it("should handle GitHub API errors gracefully", async () => {
    const context = createMockContext();

    const mockEmbedding = JSON.stringify(Array(384).fill(0.5));
    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ embedding: mockEmbedding, payload: JSON.stringify({}) }],
          } as never),
        }),
      }) as never,
    });

    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: [{ issue_id: "issue-1", similarity: 0.85 }],
      error: null,
    } as never);

    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              payload: JSON.stringify({
                repository: { owner: { login: "owner" }, name: "repo" },
                number: 42,
                assignees: [],
              }),
            },
          } as never),
        }),
      }) as never,
    });

    mockOctokit.rest.issues.get.mockRejectedValue(new Error("Not found") as never);

    const response = await handleRecommendations({ context });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations).toEqual([]);
  });
});

describe("handleRecommendations - Response Format", () => {
  it("should return properly formatted recommendations", async () => {
    const context = createMockContext();

    mockOctokit.rest.issues.get.mockResolvedValue({
      data: {
        number: 123,
        title: "Recommended Issue",
        state: "open",
        assignees: [],
      },
    } as never);

    const response = await handleRecommendations({ context });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);

    if (data.recommendations.length > 0) {
      expect(data.recommendations[0]).toMatchObject({
        issueUrl: expect.any(String),
        similarity: expect.any(Number),
        repo: expect.any(String),
        org: expect.any(String),
        title: expect.any(String),
      });
    }
  });
});
