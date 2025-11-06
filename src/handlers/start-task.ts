import { Context } from "../types/index";
import { Result } from "../types/result-types";
import { handleStartErrors } from "./start/helpers/error-messages";
import { evaluateStartEligibility } from "./start/evaluate-eligibility";
import { performAssignment } from "./start/perform-assignment";

export async function startTask(
  context: Context,
  issue: Context<"issue_comment.created">["payload"]["issue"],
  sender: Context["payload"]["sender"],
  teammates: string[]
): Promise<Result> {
  const { logger } = context;

  if (!sender) {
    throw logger.error(`Skipping '/start' since there is no sender in the context.`);
  }

  // Centralized eligibility gate without side effects
  const eligibility = await evaluateStartEligibility(context, issue, sender, teammates);

  if (!eligibility.ok) {
    // handleStartErrors will either throw or return an error result
    return await handleStartErrors(context, eligibility);
  }

  // All checks passed, perform assignment
  return performAssignment(context, issue, sender, eligibility.computed.toAssign);
}