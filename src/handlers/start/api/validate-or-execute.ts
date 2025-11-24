import { Context } from "../../../types";
import { HttpStatusCode } from "../../../types/result-types";
import { evaluateStartEligibility } from "../evaluate-eligibility";
import { performAssignment } from "../perform-assignment";
import { createCommand, createPayload, ShallowContext } from "./helpers/context-builder";
import { createRepoOctokit } from "./helpers/octokit";
import { parseIssueUrl } from "./helpers/parsers";

/**
 * Handles the validate or execute flow for a specific issue.
 * Validates eligibility and optionally performs assignment.
 */
export async function handleValidateOrExecute({
  context,
  mode,
  issueUrl,
}: {
  context: ShallowContext;
  mode: "validate" | "execute";
  issueUrl: string;
}): Promise<Response> {
  const { owner, repo, issue_number: issueNumber } = parseIssueUrl(issueUrl, context.logger);
  let issue, repository, organization;
  try {
    issue = (await context.octokit.rest.issues.get({ owner, repo, issue_number: issueNumber }))?.data;
    repository = (await context.octokit.rest.repos.get({ owner, repo }))?.data;
    organization = repository?.organization;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Issue or repository not found";
    return Response.json({ ok: false, reasons: [reason] }, { status: 404 });
  }

  // Build context
  const ctx: Context<"issue_comment.created"> & { installOctokit: Awaited<ReturnType<typeof createRepoOctokit>> } = {
    ...context,
    payload: createPayload({
      issue,
      repository,
      organization,
      sender: context.payload.sender,
    }) as Context<"issue_comment.created">["payload"],
    command: createCommand([context.payload.sender.login || ""]),
    installOctokit: {} as Awaited<ReturnType<typeof createRepoOctokit>>,
    organizations: !context.organizations.includes(organization?.login || repository.owner.login)
      ? [...context.organizations, organization?.login || repository.owner.login]
      : context.organizations,
  };

  ctx.installOctokit = await createRepoOctokit(context.env, ctx.payload.repository.owner.login, ctx.payload.repository.name);

  // Evaluate eligibility
  const preflight = await evaluateStartEligibility(ctx);

  if (mode === "validate") {
    const status = preflight.ok ? 200 : 400;
    return Response.json(
      {
        ok: preflight.ok,
        computed: preflight.computed,
        warnings: preflight.warnings ?? null,
        reasons: preflight.errors?.map((e) => e.logMessage.raw) ?? null,
      },
      { status }
    );
  }

  // Execute mode - check eligibility first
  if (!preflight.ok) {
    return Response.json(
      {
        ok: false,
        computed: preflight.computed,
        warnings: preflight.warnings ?? null,
        reasons: preflight.errors?.map((e) => e.logMessage.raw) ?? null,
      },
      { status: 400 }
    );
  }

  // Perform assignment
  try {
    const result = await performAssignment(ctx, preflight);
    return Response.json(
      {
        ok: result.status === HttpStatusCode.OK,
        content: result.content,
        metadata: preflight.computed,
      },
      { status: 200 }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Start failed";
    return Response.json({ ok: false, reasons: [reason] }, { status: 400 });
  }
}
