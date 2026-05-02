import { StaticDecode, Type as T } from "@sinclair/typebox";
import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import { AssignedIssue } from "../../../../types/payload";
import { getTransformedRole } from "../../../../utils/get-user-task-limit-and-role";

export const startQueryParamSchema = T.Object(
  {
    userId: T.Transform(T.Union([T.String(), T.Number()]))
      .Decode((val) => {
        if (typeof val === "number") return val;
        const parsed = parseInt(val, 10);
        if (!/^\d+$/.test(val) || isNaN(parsed)) return val;
        return parsed;
      })
      .Encode((val) => val.toString()),
    // Support single URL (backward compatible) OR array of URLs (max 100)
    issueUrl: T.Transform(
      T.Union([
        T.String({ minLength: 1 }),
        T.Array(T.String({ minLength: 1 }), { minItems: 1, maxItems: 100 }),
      ])
    )
      .Decode((val) => (Array.isArray(val) ? val : [val]))
      .Encode((val) => (val.length === 1 ? val[0] : val)),
    environment: T.Optional(T.Union([T.Literal("development"), T.Literal("production")])),
  },
  {
    additionalProperties: false,
  }
);

export type StartQueryParams = StaticDecode<typeof startQueryParamSchema>;

// Single URL result
export type SingleIssueResult = {
  issueUrl: string;
  ok: boolean;
  computed: StartEligibilityResult["computed"] | null;
  warnings: LogReturn[] | null;
  reasons: string[] | null;
};

// Batch response
export type BatchStartResponse = {
  ok: boolean;
  results: SingleIssueResult[];
  summary: { total: number; successful: number; failed: number };
};

export type IssueUrlParts = {
  owner: string;
  repo: string;
  issue_number: number;
};

export type DatabaseUser = {
  id: number | string;
  wallet_id: number | null;
  location_id: number | null;
};

export type StartEligibilityResult = {
  ok: boolean;
  errors: LogReturn[] | null;
  warnings: LogReturn[] | null;
  computed: {
    deadline: string | null;
    isTaskStale: boolean | null;
    wallet: string | null;
    toAssign: string[];
    assignedIssues: AssignedIssue[];
    consideredCount: number;
    senderRole: ReturnType<typeof getTransformedRole>;
  };
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
