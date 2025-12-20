import * as v from "valibot";

export const urlSchema = v.pipe(v.string(), v.url(), v.regex(/https:\/\/github\.com\/[^/]+\/[^/]+\/(issues)\/\d+$/));

export const querySchema = v.object({
  issueUrl: urlSchema,
  userId: v.string(),
  environment: v.optional(v.union([v.literal("development"), v.literal("production")])),
});

const taskSchema = v.object({
  deadline: v.date(),
  isTaskStale: v.boolean(),
  wallet: v.string(),
  toAssign: v.array(v.string()),
  senderRole: v.string(),
  consideredCount: v.number(),
  assignedIssues: v.array(
    v.object({
      title: v.string(),
      html_url: v.string(),
    })
  ),
});

export const responseSchemaGet = v.object({
  ok: v.boolean(),
  computed: taskSchema,
  warnings: v.array(
    v.object({
      logMessage: v.object({
        level: v.string(),
        raw: v.string(),
        diff: v.string(),
        type: v.string(),
      }),
      metadata: v.object({}),
    })
  ),
  reasons: v.union([v.array(v.string()), v.null()]),
});

export const responseSchemaPost = v.object({
  ok: v.boolean(),
  content: v.string(),
  metadata: taskSchema,
});
