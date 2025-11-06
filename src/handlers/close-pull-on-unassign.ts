import { Context} from "../types/index";
import { closePullRequestForAnIssue  } from "../utils/issue";
import { HttpStatusCode, Result } from "../types/result-types";

export async function closeUserUnassignedPr(context: Context<"issues.unassigned">): Promise<Result> {
    if (!("issue" in context.payload)) {
      context.logger.debug("Payload does not contain an issue, skipping issues.unassigned event.");
      return { status: HttpStatusCode.NOT_MODIFIED };
    }
    const { payload } = context;
    const { issue, repository, assignee } = payload;
    // 'assignee' is the user that actually got un-assigned during this event. Since it can theoretically be null,
    // we display an error if none is found in the payload.
    if (!assignee) {
      throw context.logger.fatal("No assignee found in payload, failed to close pull-requests.");
    }
    await closePullRequestForAnIssue(context, issue.number, repository, assignee?.login);
    return { status: HttpStatusCode.OK, content: "Linked pull-requests closed." };
  }
  