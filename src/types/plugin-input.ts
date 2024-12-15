import { StaticDecode, TLiteral, Type as T, Union } from "@sinclair/typebox";

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

const rolesWithReviewAuthority = T.Array(T.Enum(Role), {
  default: [Role.OWNER, Role.ADMIN, Role.MEMBER, Role.COLLABORATOR],
  uniqueItems: true,
  description: "When considering a user for a task: which roles should be considered as having review authority? All others are ignored.",
  examples: [
    [Role.OWNER, Role.ADMIN],
    [Role.MEMBER, Role.COLLABORATOR],
  ],
});

const maxConcurrentTasks = T.Transform(
  T.Record(T.String(), T.Integer(), {
    default: { member: 10, contributor: 2 },
    description: "The maximum number of tasks a user can have assigned to them at once, based on their role.",
    examples: [{ member: 5, contributor: 1 }],
  })
)
  .Decode((obj) => {
    // normalize the role keys to lowercase
    obj = Object.keys(obj).reduce(
      (acc, key) => {
        acc[key.toLowerCase()] = obj[key];
        return acc;
      },
      {} as Record<string, number>
    );

    // If admin is omitted, defaults to infinity
    if (!obj["admin"]) {
      obj["admin"] = Infinity;
    }

    return obj;
  })
  .Encode((value) => value);

type IntoStringLiteralUnion<T> = { [K in keyof T]: T[K] extends string ? TLiteral<T[K]> : never };

export function stringLiteralUnion<T extends string[]>(values: [...T]): Union<IntoStringLiteralUnion<T>> {
  const literals = values.map((value) => T.Literal(value));
  return T.Union(literals) as Union<IntoStringLiteralUnion<T>>;
}

const roles = stringLiteralUnion(["admin", "member", "contributor", "owner"]);

const requiredLabel = T.Object({ name: T.String(), roles: T.Array(roles, { uniqueItems: true, default: [] }) });

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
