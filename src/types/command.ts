import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";

export const startCommandSchema = T.Object({
  name: T.Literal("start"),
  parameters: T.Object({
    teammates: T.Array(T.String()),
  }),
});

export const stopCommandSchema = T.Object({
  name: T.Literal("stop"),
});

export const commandSchema = T.Union([startCommandSchema, stopCommandSchema]);

export type Command = StaticDecode<typeof commandSchema>;
