import { HttpStatusCode } from "../../../types/result-types";
import { evaluateStartEligibility } from "../evaluate-eligibility";
import { performAssignment } from "../perform-assignment";
import { createCommand, createPayload, ShallowContext } from "./helpers/context-builder";
import { Context } from "../../../types";
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
  if (!issueUrl) {
    return Response.json(
      {
        ok: false,
        reasons: ["issueUrl is required for validate or execute mode."],
      },
      { status: 400 }
    );
  }

  const { owner, repo, issue_number: issueNumber } = parseIssueUrl(issueUrl);
  const issue = (await context.octokit.rest.issues.get({ owner, repo, issue_number: issueNumber })).data;
  const repository = (await context.octokit.rest.repos.get({ owner, repo })).data;
  const organization = repository.organization;

  // Build context
  const ctx: Context<"issue_comment.created"> = {
    ...context,
    payload: createPayload({
      issue,
      repository,
      organization,
      sender: context.payload.sender,
    }) as Context<"issue_comment.created">["payload"],
    command: createCommand([context.payload.sender.login || ""]),
    organizations: !context.organizations.includes(organization?.login || repository.owner.login)
      ? [...context.organizations, organization?.login || repository.owner.login]
      : context.organizations,
  };

  // Evaluate eligibility
  const preflight = await evaluateStartEligibility(ctx);

  if (mode === "validate") {
    const status = preflight.ok ? 200 : 400;
    return Response.json(
      {
        ok: preflight.ok,
        reasons: preflight.errors.map((e) => e.logMessage.raw),
        warnings: preflight.warnings,
        computed: preflight.computed,
      },
      { status }
    );
  }

  // Execute mode - check eligibility first
  if (!preflight.ok) {
    return Response.json(
      {
        ok: false,
        reasons: preflight.errors.map((e) => e.logMessage.raw),
        warnings: preflight.warnings,
        computed: preflight.computed,
      },
      { status: 400 }
    );
  }

  // Perform assignment
  try {
    const result = await performAssignment(ctx, preflight.computed.toAssign);
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
