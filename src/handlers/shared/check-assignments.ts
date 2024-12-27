import { Context } from "../../types";
import { getOwnerRepoFromHtmlUrl } from "../../utils/issue";
import { getAssignmentPeriods } from "./user-assigned-timespans";

export async function hasUserBeenUnassigned(context: Context, username: string): Promise<boolean> {
  const {
    env: { BOT_USER_ID },
  } = context;
  const events = await getAssignmentEvents(context);
  const userAssignments = events.filter((event) => event.assignee === username);

  if (userAssignments.length === 0) {
    return false;
  }

  const unassignedEvents = userAssignments.filter((event) => event.event === "unassigned");
  // TODO: task-xp-guard: will also prevent future assignments so we need to add a comment tracker we can use here
  // UI assignment
  const adminUnassigned = unassignedEvents.filter((event) => event.actor !== username && event.actorId !== BOT_USER_ID);

  if ("issue" in context.payload) {
    const { number, html_url } = context.payload.issue;
    const { owner, repo } = getOwnerRepoFromHtmlUrl(html_url);
    const assignmentPeriods = await getAssignmentPeriods(context.octokit, { owner, repo, issue_number: number });
    return assignmentPeriods[username].some((period) => period.reason === "bot") || adminUnassigned.length > 0;
  }

  return adminUnassigned.length > 0;
}

async function getAssignmentEvents(context: Context) {
  if (!("issue" in context.payload)) {
    throw new Error("The context does not contain an issue.");
  }
  const { repository, issue } = context.payload;
  try {
    const data = await context.octokit.paginate(context.octokit.rest.issues.listEventsForTimeline, {
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: issue.number,
    });

    const events = data
      .filter((event) => event.event === "assigned" || event.event === "unassigned")
      .map((event) => {
        let actor, assignee, createdAt, actorId;

        if ((event.event === "unassigned" || event.event === "assigned") && "actor" in event && event.actor && "assignee" in event && event.assignee) {
          actor = event.actor.login;
          assignee = event.assignee.login;
          createdAt = event.created_at;
          actorId = event.actor.id;
        }

        return {
          event: event.event,
          actor,
          actorId,
          assignee,
          createdAt,
        };
      });

    return events
      .filter((event) => event !== undefined)
      .sort((a, b) => {
        return new Date(a.createdAt || "").getTime() - new Date(b.createdAt || "").getTime();
      });
  } catch (error) {
    throw new Error(context.logger.error("Error while getting assignment events", { error: error as Error }).logMessage.raw);
  }
}
