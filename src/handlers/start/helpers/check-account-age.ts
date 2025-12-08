import { Context } from "../../../types/index";

export type UserProfile = {
  id: number;
  login: string;
  created_at?: string;
};

export type AccountAgeResult = {
  messages: string[];
  metadata: Array<Record<string, unknown>>;
};

/**
 * Validates that users meet the minimum account age requirement.
 * Only checks contributors (not collaborators or admins).
 *
 * @param context - The application context
 * @param participants - List of usernames to check
 * @param userProfiles - Map of already-fetched user profiles
 * @param participantRoleAndLimits - Map of user roles
 * @param accountRequiredAgeDays - Minimum account age in days
 * @returns Object containing warning messages and metadata for users who don't meet requirements
 */
export async function checkAccountAge(
  context: Context,
  participants: string[],
  userProfiles: Map<string, UserProfile>,
  participantRoleAndLimits: Map<string, { role: string }>,
  accountRequiredAgeDays: number
): Promise<AccountAgeResult> {
  const { logger } = context;
  const accountAgeMessages: string[] = [];
  const ageMetadata: Array<Record<string, unknown>> = [];

  if (accountRequiredAgeDays <= 0) {
    return { messages: [], metadata: [] };
  }

  // Filter to only check access-controlled participants (not collaborators/admins)
  const accessControlledParticipants = participants.filter((username) => {
    const role = participantRoleAndLimits.get(username.toLowerCase())?.role ?? "contributor";
    return role !== "collaborator" && role !== "admin";
  });

  if (accessControlledParticipants.length === 0) {
    return { messages: [], metadata: [] };
  }

  // Fetch missing user profiles
  for (const username of accessControlledParticipants) {
    const normalizedUsername = username.toLowerCase();
    if (userProfiles.has(normalizedUsername)) {
      continue;
    }
    try {
      const { data } = await context.octokit.rest.users.getByUsername({ username });
      const profile = { id: data.id, login: data.login, created_at: data.created_at };
      userProfiles.set(normalizedUsername, profile);
      userProfiles.set(data.login.toLowerCase(), profile);
    } catch (err) {
      const message = `Unable to load GitHub profile for ${username}.`;
      logger.error(message, { username, err });
      throw logger.error(message, { username, err });
    }
  }

  const now = Date.now();

  for (const username of accessControlledParticipants) {
    const profile = userProfiles.get(username.toLowerCase());
    if (!profile?.created_at) {
      accountAgeMessages.push(`@${username} cannot start this task because the account creation date could not be verified.`);
      ageMetadata.push({ username, reason: "missing_created_at" });
      continue;
    }

    const createdAtMs = Date.parse(profile.created_at);
    if (Number.isNaN(createdAtMs)) {
      accountAgeMessages.push(`@${username} cannot start this task because the account creation date could not be verified.`);
      ageMetadata.push({ username, reason: "invalid_created_at", rawCreatedAt: profile.created_at });
      continue;
    }

    const accountAge = Math.floor((now - createdAtMs) / (1000 * 60 * 60 * 24));
    if (accountAge < accountRequiredAgeDays) {
      accountAgeMessages.push(`@${username} needs an account at least ${accountRequiredAgeDays} days old (currently ${accountAge} days).`);
      ageMetadata.push({ username, accountAge });
    }
  }

  return { messages: accountAgeMessages, metadata: ageMetadata };
}
