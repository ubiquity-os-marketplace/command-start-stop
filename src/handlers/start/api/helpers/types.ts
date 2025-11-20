import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";
import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";

import { AssignedIssue } from "../../../../types";
import { getTransformedRole } from "../../../../utils/get-user-task-limit-and-role";

export const startQueryParamSchema = T.Object(
  {
    userId: T.Transform(T.Union([T.String(), T.Number()]))
      .Decode((val) => {
        if (typeof val === "number") return val;
        const parsed = parseInt(val, 10);
        if (isNaN(parsed)) throw new Error("userId must be a number or numeric string");
        return parsed;
      })
      .Encode((val) => val.toString()),
    issueUrl: T.String({ minLength: 1 }),
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

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export type DatabaseUser = {
  id: number;
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
