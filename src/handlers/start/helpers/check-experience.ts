import { Context, Label } from "../../../types/index";
import { getUserExperience } from "../../../utils/get-user-experience";

export type ExperienceResult = {
  messages: string[];
  metadata: Array<{ username: string; xp: number }>;
  requiredExperience: number | null;
};

/**
 * Validates that users meet the minimum XP requirement based on issue priority labels.
 * Only checks contributors (not collaborators or admins).
 *
 * @param context - The application context
 * @param participants - List of usernames to check
 * @param participantRoleAndLimits - Map of user roles
 * @param labels - Issue labels to check for priority thresholds
 * @returns Object containing warning messages and metadata for users who don't meet requirements
 */
export async function checkExperience(
  context: Context,
  participants: string[],
  participantRoleAndLimits: Map<string, { role: string }>,
  labels: Label[]
): Promise<ExperienceResult> {
  const { logger, config, env } = context;
  const { experience } = config.taskAccessControl;

  const xpMessages: string[] = [];
  const xpMetadata: Array<{ username: string; xp: number }> = [];

  // Determine required XP from priority labels
  const experienceThresholds = experience?.priorityThresholds ?? [];
  const issueLabelsLower = labels.map((label) => label.name.toLowerCase());
  const requiredExperience = experienceThresholds
    .filter((threshold) => issueLabelsLower.includes(threshold.label.toLowerCase()))
    .reduce<number | null>((accumulator, current) => {
      if (accumulator === null) {
        return current.minimumXp;
      }
      return Math.max(accumulator, current.minimumXp);
    }, null);

  // No XP requirement found
  if (requiredExperience === null) {
    return { messages: [], metadata: [], requiredExperience };
  }

  // Filter to only check access-controlled participants (not collaborators/admins)
  const accessControlledParticipants = participants.filter((username) => {
    const role = participantRoleAndLimits.get(username.toLowerCase())?.role ?? "contributor";
    return role !== "collaborator" && role !== "admin";
  });

  if (accessControlledParticipants.length === 0) {
    return { messages: [], metadata: [], requiredExperience };
  }

  const xpServiceBaseUrl = env.XP_SERVICE_BASE_URL ?? "https://os-daemon-xp.ubq.fi";

  for (const username of accessControlledParticipants) {
    try {
      logger.debug(`Trying to fetch XP for the user ${username}`);
      const xp = await getUserExperience(context, xpServiceBaseUrl, username);
      xpMetadata.push({ username, xp });
      if (xp < requiredExperience) {
        xpMessages.push(`@${username} needs at least ${requiredExperience} XP to start this task (currently ${xp}).`);
      }
    } catch (err) {
      xpMessages.push(`@${username} - unable to verify experience at this time.`);
      logger.error(`Unable to verify XP for ${username}.`, { username, err });
      /**
       * Throwing an error is not ideal, because P0-P2 require negative or zero XP.
       * If the XP service is down or unreachable, we don't want to block users
       * from starting tasks they should be allowed to start. Hence, we log the error and continue.
       */
    }
  }

  return { messages: xpMessages, metadata: xpMetadata, requiredExperience };
}
