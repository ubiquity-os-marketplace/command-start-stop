import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import { StartStopSettings } from "./plugin-input";
import { createAdapters } from "../adapters";
import { Env } from "./env";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";

export type SupportedEventsU = "issue_comment.created" | "issues.assigned";

export type SupportedEvents = {
  [K in SupportedEventsU]: K extends WebhookEventName ? WebhookEvent<K> : never;
};

export function isContextCommentCreated(context: Context): context is Context<"issue_comment.created"> {
  return "comment" in context.payload;
}

export interface Context<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]> {
  eventName: T;
  payload: TU["payload"];
  octokit: InstanceType<typeof Octokit>;
  adapters: ReturnType<typeof createAdapters>;
  config: StartStopSettings;
  env: Env;
  logger: Logs;
}
