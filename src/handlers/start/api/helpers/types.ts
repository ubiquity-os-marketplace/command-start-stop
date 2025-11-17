import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";

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
    mode: T.Union([T.Literal("validate"), T.Literal("execute")], { default: "validate" }),
  },
  {
    additionalProperties: false,
  }
);

export type StartQueryParams = StaticDecode<typeof startQueryParamSchema>;

export function getRequestQueryParamsValidator() {
  return new StandardValidator<typeof startQueryParamSchema>(startQueryParamSchema);
}

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
