import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";

export const startCommandSchema = T.Object({
  name: T.Literal("start", { description: 'Assign yourself and/or others to the issue/task.', examples: ['/start'] }),
  parameters: T.Object({
    teammates: T.Array(T.String(), { description: "GitHub usernames to assign to the issue/task.", examples: [["@UbiquityOS"]] }),
  }),
});

export const stopCommandSchema = T.Object({
  name: T.Literal("stop", { description: 'Unassign yourself from the issue/task.', examples: ['/stop'] }),
});

export const commandSchema = T.Union([startCommandSchema, stopCommandSchema]);

export type Command = StaticDecode<typeof commandSchema>;
