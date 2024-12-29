import { Context } from "../../types";

interface MatchingUserProps {
  role: string;
  limit: number;
}

export async function getUserRoleAndTaskLimit(context: Context, user: string): Promise<MatchingUserProps> {
  const orgLogin = context.payload.organization?.login;
  const { config, logger, octokit } = context;
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

    let role = "contributor";
    let limit;

    try {
      const response = await octokit.rest.orgs.getMembershipForUser({
        org: orgLogin,
        username: user,
      });
      role = response.data.role.toLowerCase();
      limit = maxConcurrentTasks[role];
    } catch (err) {
      logger.error("Could not get user membership", { err });
    }

    // If we failed to get organization membership, narrow down to repo role
    const permissionLevel = await octokit.rest.repos.getCollaboratorPermissionLevel({
      username: user,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    });
    role = permissionLevel.data.role_name?.toLowerCase();
    context.logger.debug(`Retrieved collaborator permission level for ${user}.`, {
      user,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      isAdmin: permissionLevel.data.user?.permissions?.admin,
      role,
      data: permissionLevel.data,
    });
    if (role && maxConcurrentTasks[role]) {
      limit = maxConcurrentTasks[role];
    }

    return limit ? { role, limit } : { ...minUserTaskLimit, role };
  } catch (err) {
    logger.error("Could not get user role", { err });
    return minUserTaskLimit;
  }
}
