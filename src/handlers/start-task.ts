import { Context } from "../types/index";
import { Result } from "../types/result-types";

import { evaluateStartEligibility } from "./start/evaluate-eligibility";
import { handleStartErrors } from "./start/helpers/error-messages";
import { performAssignment } from "./start/perform-assignment";

export async function startTask(context: Context<"issue_comment.created">): Promise<Result> {
  const {
    logger,
    payload: { sender },
  } = context;

  if (!sender) {
    throw logger.error(`Skipping '/start' since there is no sender in the context.`);
  }

  // Centralized eligibility gate without side effects
  const eligibility = await evaluateStartEligibility(context);

  if (!eligibility.ok) {
    // handleStartErrors will either throw or return an error result
    return await handleStartErrors(context, eligibility);
  }

  // All checks passed, perform assignment
  return performAssignment(context, eligibility.computed.toAssign);
}
