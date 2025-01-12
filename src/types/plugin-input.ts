import { StaticDecode, Type as T } from "@sinclair/typebox";

export enum AssignedIssueScope {
  ORG = "org",
  REPO = "repo",
  NETWORK = "network",
}

export enum Role {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  COLLABORATOR = "COLLABORATOR",
}

// These correspond to getMembershipForUser and getCollaboratorPermissionLevel for a user.
// Anything outside these values is considered to be a contributor (external user).
export const ADMIN_ROLES = ["admin", "owner", "billing_manager"];
export const COLLABORATOR_ROLES = ["write", "member", "collaborator"];

const rolesWithReviewAuthority = T.Array(T.Enum(Role), {
  default: [Role.OWNER, Role.ADMIN, Role.MEMBER, Role.COLLABORATOR],
  uniqueItems: true,
  description: "When considering a user for a task: which roles should be considered as having review authority? All others are ignored.",
  examples: [
    [Role.OWNER, Role.ADMIN],
    [Role.MEMBER, Role.COLLABORATOR],
  ],
});

const maxConcurrentTasks = T.Object(
  { collaborator: T.Number({ default: 10 }), contributor: T.Number({ default: 2 }) },
  {
    description: "The maximum number of tasks a user can have assigned to them at once, based on their role.",
    examples: [{ collaborator: 10, contributor: 2 }],
    default: {},
  }
);

const roles = T.KeyOf(maxConcurrentTasks);

const requiredLabel = T.Object({
  name: T.String({ description: "The name of the required labels to start the task." }),
  allowedRoles: T.Array(roles, {
    description: "The list of allowed roles to start the task with the given label.",
    uniqueItems: true,
    default: [],
    examples: [["collaborator", "contributor"]],
  }),
});

export const pluginSettingsSchema = T.Object(
  {
    reviewDelayTolerance: T.String({
      default: "1 Day",
      examples: ["1 Day", "5 Days"],
      description:
        "When considering a user for a task: if they have existing PRs with no reviews, how long should we wait before 'increasing' their assignable task limit?",
    }),
    taskStaleTimeoutDuration: T.String({
      default: "30 Days",
      examples: ["1 Day", "5 Days"],
      description: "When displaying the '/start' response, how long should we wait before considering a task 'stale' and provide a warning?",
    }),
    startRequiresWallet: T.Boolean({
      default: true,
      description: "If true, users must set their wallet address with the /wallet command before they can start tasks.",
    }),
    maxConcurrentTasks: maxConcurrentTasks,
    assignedIssueScope: T.Enum(AssignedIssueScope, {
      default: AssignedIssueScope.ORG,
      description: "When considering a user for a task: should we consider their assigned issues at the org, repo, or network level?",
      examples: [AssignedIssueScope.ORG, AssignedIssueScope.REPO, AssignedIssueScope.NETWORK],
    }),
    emptyWalletText: T.String({
      default: "Please set your wallet address with the /wallet command first and try again.",
      description: "a message to display when a user tries to start a task without setting their wallet address.",
    }),
    rolesWithReviewAuthority: T.Transform(rolesWithReviewAuthority)
      .Decode((value) => value.map((role) => role.toUpperCase()))
      .Encode((value) => value.map((role) => Role[role as keyof typeof Role])),
    requiredLabelsToStart: T.Array(requiredLabel, {
      default: [],
      description: "If set, a task must have at least one of these labels to be started.",
      examples: [["Priority: 5 (Emergency)"], ["Good First Issue"]],
    }),
  },
  {
    default: {},
  }
);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
