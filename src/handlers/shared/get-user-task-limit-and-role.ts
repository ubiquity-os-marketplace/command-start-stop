import { Context } from "../../types";

interface MatchingUserProps {
  role: string;
  limit: number;
}

export async function getUserRoleAndTaskLimit(context: Context, user: string): Promise<MatchingUserProps> {
  const orgLogin = context.payload.organization?.login;
  const { config, logger } = context;
  const { maxConcurrentTasks } = config;

  const minUserTaskLimit = Object.entries(maxConcurrentTasks).reduce((minTask, [role, limit]) => (limit < minTask.limit ? { role, limit } : minTask), {
    role: "",
    limit: Infinity,
  } as MatchingUserProps);

  try {
    // Validate the organization login
    if (typeof orgLogin !== "string" || orgLogin.trim() === "") {
      throw new Error("Invalid organization name");
    }

    const response = await context.octokit.rest.orgs.getMembershipForUser({
      org: orgLogin,
      username: user,
    });

    const role = response.data.role.toLowerCase();
    const limit = maxConcurrentTasks[role];

    return limit ? { role, limit } : minUserTaskLimit;
  } catch (err) {
    logger.error("Could not get user role", { err });
    return minUserTaskLimit;
  }
}
