import * as v from "valibot";

export const urlSchema = v.pipe(v.string(), v.url(), v.regex(/https:\/\/github\.com\/[^/]+\/[^/]+\/(issues|pull)\/\d+$/));

export const querySchema = v.object({
  issueUrl: urlSchema,
  userId: v.union([v.string(), v.number()]),
});

export const responseSchemaGet = v.record(
  v.string(),
  v.union([
    v.object({
      matchResultArray: v.record(v.string(), v.array(v.string())),
      similarIssues: v.array(
        v.object({
          id: v.string(),
          issue_id: v.string(),
          similarity: v.number(),
        })
      ),
      sortedContributors: v.array(
        v.object({
          login: v.string(),
          matches: v.array(v.string()),
          maxSimilarity: v.number(),
        })
      ),
    }),
    v.null(),
  ])
);

export const responseSchemaPost = v.object({
  ok: v.boolean(),
  content: v.string(),
  metadata: v.object({
    deadline: v.date(),
    isTaskStale: v.boolean(),
    wallet: v.string(),
    toAssign: v.array(v.string()),
    senderRole: v.string(),
    consideredCount: v.number(),
    assignedIssues: v.array(v.object({ title: v.string(), html_url: v.string() })),
  }),
});
