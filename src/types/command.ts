import { StaticDecode, Type as T } from "@sinclair/typebox";

export const startCommandSchema = T.Object({
  name: T.Literal("start", {
    examples: ["/start"],
    description: "Assign yourself and/or others to the issue/task.",
  }),
  parameters: T.Object({
    teammates: T.Optional(
      T.Array(T.String({ description: "GitHub username" }), {
        description: "Users other than yourself to assign to the issue",
      })
    ),
  }),
});

export const stopCommandSchema = T.Object({
  name: T.Literal("stop", {
    description: "Unassign yourself from the issue/task.",
    examples: ["/stop"],
  }),
});

export const commandSchema = T.Union([startCommandSchema, stopCommandSchema]);

export type Command = StaticDecode<typeof commandSchema>;
