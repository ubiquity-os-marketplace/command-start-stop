export async function getUserExperience(baseUrl: string, user: string): Promise<number> {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("XP service base URL is invalid");
  }

  const trimmedPath = url.pathname.replace(/\/$/, "");
  url.pathname = `${trimmedPath}/xp`;
  url.searchParams.set("user", user);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch XP for ${user}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Failed to parse XP response for ${user}`);
  }

  const xp = resolveExperienceValue(payload);
  if (xp === null || Number.isNaN(xp)) {
    throw new Error(`XP value missing for ${user}`);
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
