import { ADMIN_ROLES, COLLABORATOR_ROLES, Context, PluginSettings } from "../../types/index";

interface MatchingUserProps {
  role: string;
  limit: number;
}

export function isAdminRole(role: string) {
  return ADMIN_ROLES.includes(role.toLowerCase());
}

export function isCollaboratorRole(role: string) {
  return COLLABORATOR_ROLES.includes(role.toLowerCase());
}

export function getTransformedRole(role: string) {
  role = role.toLowerCase();
  if (isAdminRole(role)) {
    return "admin";
  } else if (isCollaboratorRole(role)) {
    return "collaborator";
  }
  return "contributor";
}

export function getUserTaskLimit(maxConcurrentTasks: PluginSettings["maxConcurrentTasks"], role: string) {
  if (isAdminRole(role)) {
    return Infinity;
  }
  if (isCollaboratorRole(role)) {
    return maxConcurrentTasks.collaborator;
  }
  return maxConcurrentTasks.contributor;
}

export async function getUserRoleAndTaskLimit(context: Context, user: string): Promise<MatchingUserProps> {
  const orgLogin = context.payload.organization?.login;
  const { config, logger, octokit } = context;
  const { maxConcurrentTasks } = config;

  try {
    // Validate the organization login
    if (typeof orgLogin !== "string" || orgLogin.trim() === "") {
      throw new Error("Invalid organization name");
    }

    let role;
    let limit;

    try {
      const response = await octokit.rest.orgs.getMembershipForUser({
        org: orgLogin,
        username: user,
      });
      role = response.data.role.toLowerCase();
      limit = getUserTaskLimit(maxConcurrentTasks, role);
      return { role, limit };
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
    limit = getUserTaskLimit(maxConcurrentTasks, role);

    return { role: getTransformedRole(role), limit };
  } catch (err) {
    logger.error("Could not get user role", { err });
    return { role: "unknown", limit: maxConcurrentTasks.contributor };
  }
}
