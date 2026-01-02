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
    issueUrl: T.String({ minLength: 1 }),
    environment: T.Optional(T.Union([T.Literal("development"), T.Literal("production")])),
  },
  {
    additionalProperties: false,
  }
);

export type StartQueryParams = StaticDecode<typeof startQueryParamSchema>;

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
