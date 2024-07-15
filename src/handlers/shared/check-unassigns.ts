import { Context } from "../../types";

export async function wasPreviouslyUnassigned(
  context: Context,
  senderLogin: Context["payload"]["sender"],
  issueNumber: Context["payload"]["issue"]
): Promise<boolean> {
  try {
    const issueEvents = await context.octokit.issues.listEventsForTimeline({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: issueNumber.id,
    });

    return issueEvents.data.some((event) => event.event === "unassigned" && event.event === senderLogin);
  } catch (error) {
    console.error("Error while checking previous assignment:", error);
    return false;
  }
}
