import { Context as PluginContext } from "@ubiquity-os/plugin-sdk";

import { createAdapters } from "../adapters/index";

import { Command } from "./command";
import { Env } from "./env";
import { PluginSettings } from "./plugin-input";

export type SupportedEvents = "issue_comment.created" | "pull_request.opened" | "pull_request.edited" | "issues.unassigned";

export function isIssueCommentEvent(context: Context): context is Context<"issue_comment.created"> {
  return "issue" in context.payload;
}

export type Context<TEvents extends SupportedEvents = SupportedEvents> = PluginContext<PluginSettings, Env, Command, TEvents> & {
  adapters: ReturnType<typeof createAdapters>;
  organizations: string[];
};
