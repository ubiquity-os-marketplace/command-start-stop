import { StaticDecode, Type as T } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { Context } from "../types/context";

const xpUserSchema = T.Object({
  login: T.String({ minLength: 1 }),
  id: T.Number(),
  hasData: T.Boolean(),
  total: T.Number(),
  permitCount: T.Number(),
});

const xpResponseSchema = T.Object({
  users: T.Array(xpUserSchema),
});

type XpResponse = StaticDecode<typeof xpResponseSchema>;

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

  const xpPayload = decodeXpPayload(context, user, payload);
  const xp = getXpFromPayload(xpPayload, user);
  if (xp === null || Number.isNaN(xp)) {
    context.logger.info(`XP value missing for ${user}`, { payload: xpPayload });
    return 0;
  }

  return xp;
}

function decodeXpPayload(context: Context, user: string, data: unknown): XpResponse {
  if (!isXpResponse(data)) {
    throw context.logger.error(`Invalid XP payload for ${user}`, { data });
  }
  return data;
}

function getXpFromPayload(payload: XpResponse, username: string): number | null {
  const normalizedUsername = username.toLowerCase();
  const match = payload.users.find((entry) => entry.login.toLowerCase() === normalizedUsername);
  return match?.total ?? null;
}

function isXpResponse(value: unknown): value is XpResponse {
  return Value.Check(xpResponseSchema, value);
}
