import { Context } from "../types/index";
import { Result } from "../types/result-types";
import { createRepoOctokit } from "./start/api/helpers/octokit";
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

  const installOctokit = await createRepoOctokit(context.env, context.payload.repository.owner.login, context.payload.repository.name);

  const newCtx = {
    ...context,
    installOctokit,
  } as Context<"issue_comment.created"> & { installOctokit: Context["octokit"] };

  // Centralized eligibility gate without side effects
  const eligibility = await evaluateStartEligibility(newCtx);
  if (!eligibility.ok) {
    // handleStartErrors will either throw or return an error result
    return await handleStartErrors(newCtx, eligibility);
  }

  // All checks passed, perform assignment
  return performAssignment(newCtx, eligibility);
}
