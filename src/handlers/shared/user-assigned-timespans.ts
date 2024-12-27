import { Context } from "../../types";

interface IssueParams {
  owner: string;
  repo: string;
  issue_number: number;
}

interface UserAssignments {
  [username: string]: AssignmentPeriod[];
}

interface AssignmentPeriod {
  assignedAt: string;
  unassignedAt: string | null;
  reason: "user" | "bot";
}

/*
 * Returns all the assignment periods by user, with the reason of the un-assignments. If it is instigated by the user,
 * (e.g. GitHub UI or using /stop), the reason will be "user", otherwise "bot".
 */
export async function getAssignmentPeriods(octokit: Context["octokit"], issueParams: IssueParams) {
  const [events, comments] = await Promise.all([
    octokit.paginate(octokit.rest.issues.listEvents, {
      ...issueParams,
      per_page: 100,
    }),
    octokit.paginate(octokit.rest.issues.listComments, {
      ...issueParams,
      per_page: 100,
    }),
  ]);
  const stopComments = comments
    .filter((comment) => comment.body?.trim() === "/stop")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const userAssignments: UserAssignments = {};
  const sortedEvents = events
    .filter((event) => ["assigned", "unassigned"].includes(event.event))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  sortedEvents.forEach((event) => {
    const username = "assignee" in event ? event.assignee?.login : null;
    if (!username) return;

    if (!userAssignments[username]) {
      userAssignments[username] = [];
    }

    const lastPeriod = userAssignments[username][userAssignments[username].length - 1];

    if (event.event === "assigned") {
      const newPeriod: AssignmentPeriod = {
        assignedAt: event.created_at,
        unassignedAt: null,
        reason: "bot",
      };
      userAssignments[username].push(newPeriod);
    } else if (event.event === "unassigned" && lastPeriod && lastPeriod.unassignedAt === null) {
      lastPeriod.unassignedAt = event.created_at;
      const periodStart = new Date(lastPeriod.assignedAt).getTime();
      const periodEnd = new Date(event.created_at).getTime();

      const hasStopCommand =
        stopComments.some((comment) => {
          const commentTime = new Date(comment.created_at).getTime();
          return commentTime >= periodStart && commentTime <= periodEnd;
        }) ||
        ("assigner" in event && event.assigner.type !== "Bot");

      if (hasStopCommand) {
        lastPeriod.reason = "user";
      }
    }
  });

  return userAssignments;
}
