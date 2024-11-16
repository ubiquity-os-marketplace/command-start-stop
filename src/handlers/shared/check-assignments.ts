import { Context } from "../../types";
import { getOwnerRepoFromHtmlUrl } from "../../utils/issue";

async function getUserStopComments(context: Context, username: string): Promise<number> {
  if (!("issue" in context.payload)) {
    throw new Error("The context does not contain an issue.");
  }
  const { payload, octokit, logger } = context;
  const { number, html_url } = payload.issue;
  const { owner, repo } = getOwnerRepoFromHtmlUrl(html_url);

  try {
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: number,
    });

    return comments.filter((comment) => comment.body?.includes("/stop") && comment.user?.login.toLowerCase() === username.toLowerCase()).length;
  } catch (error) {
    throw new Error(logger.error("Error while getting user stop comments", { error: error as Error }).logMessage.raw);
  }
}

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
  // all bot unassignments (/stop, disqualification,  etc)
  // TODO: task-xp-guard: will also prevent future assignments so we need to add a comment tracker we can use here
  const botUnassigned = unassignedEvents.filter((event) => event.actorId === BOT_USER_ID);
  // UI assignment
  const adminUnassigned = unassignedEvents.filter((event) => event.actor !== username && event.actorId !== BOT_USER_ID);
  // UI assignment
  const userUnassigned = unassignedEvents.filter((event) => event.actor === username);
  const userStopComments = await getUserStopComments(context, username);
  /**
   * Basically the bot will be the actor in most cases but if we
   * remove the /stop usage which does not trigger future disqualification
   * then any other bot unassignment will be considered valid
   */

  const botMinusUserStopCommands = Math.max(0, botUnassigned.length - userStopComments);
  const userUiMinusUserStopCommands = Math.max(0, userUnassigned.length - userStopComments);

  return botMinusUserStopCommands > 0 || userUiMinusUserStopCommands > 0 || adminUnassigned.length > 0;
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
