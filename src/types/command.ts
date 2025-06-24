import { StaticDecode, Type as T } from "@sinclair/typebox";

export const startCommandSchema = T.Object({
  name: T.Literal("start"),
  parameters: T.Object({
    teammates: T.Array(T.String()),
  }),
});

export const stopCommandSchema = T.Object({
  name: T.Literal("stop"),
});

export const timeCommandSchema = T.Object({
  name: T.Literal("time"),
  parameters: T.Object({
    duration: T.String(),
  }),
});

export const commandSchema = T.Union([startCommandSchema, stopCommandSchema, timeCommandSchema]);

export type Command = StaticDecode<typeof commandSchema>;
