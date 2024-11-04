import { Context } from "../types";

export async function isUserCollaborator(context: Context, username: string): Promise<boolean> {
  try {
    const { data } = await context.octokit.rest.orgs.getMembershipForUser({
      org: context.payload.repository.owner.login,
      username,
    });
    return ["collaborator", "member", "admin"].includes(data.role);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      return false;
    }
    throw error;
  }
}
