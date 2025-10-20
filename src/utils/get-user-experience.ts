import { Context } from "../types";

export async function getUserExperience(context: Context, baseUrl: string, user: string): Promise<number> {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw context.logger.error("XP service base URL is invalid");
  }

  const trimmedPath = url.pathname.replace(/\/$/, "");
  url.pathname = `${trimmedPath}/xp`;
  url.searchParams.set("user", user);

  console.log("url", url.toString());
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw context.logger.error(`Failed to fetch XP for ${user}`, {
      statusNumber: response.status,
      statusText: response.statusText,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    throw context.logger.error(`Failed to parse XP response for ${user}`, { err });
  }

  const xp = resolveExperienceValue(payload);
  if (xp === null || Number.isNaN(xp)) {
    throw context.logger.error(`XP value missing for ${user}`, { xp });
  }

  return xp;
}

function resolveExperienceValue(data: unknown): number | null {
  if (typeof data === "number") {
    return data;
  }

  if (typeof data === "string") {
    const parsed = Number(data);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (Array.isArray(data)) {
    for (const entry of data) {
      const value = resolveExperienceValue(entry);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  if (typeof data === "object" && data) {
    const record = data as Record<string, unknown>;
    if (record.xp !== undefined) {
      return resolveExperienceValue(record.xp);
    }
    if (record.data !== undefined) {
      return resolveExperienceValue(record.data);
    }
  }

  return null;
}
