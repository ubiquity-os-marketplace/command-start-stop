import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";

export const startBodySchema = T.Object({
  userId: T.Number({ minimum: 1 }),
  issueUrl: T.String({ minLength: 1 }),
  mode: T.Union([T.Literal("validate"), T.Literal("execute")], { default: "validate" }),
});

export type StartBody = StaticDecode<typeof startBodySchema>;

export function getRequestBodyValidator() {
  return new StandardValidator<typeof startBodySchema>(startBodySchema);
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
