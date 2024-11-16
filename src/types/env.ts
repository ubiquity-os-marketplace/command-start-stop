import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";

const ERROR_MSG = "Invalid BOT_USER_ID";
export const envSchema = T.Object({
  SUPABASE_URL: T.String(),
  SUPABASE_KEY: T.String(),
  BOT_USER_ID: T.Transform(T.Union([T.String(), T.Number()], { examples: 123456 }))
    .Decode((value) => {
      if (typeof value === "string" && !isNaN(Number(value))) {
        return Number(value);
      }
      if (typeof value === "number") {
        return value;
      }
      throw new Error(ERROR_MSG);
    })
    .Encode((value) => {
      if (typeof value === "number") {
        return value.toString();
      }
      if (typeof value === "string") {
        return value;
      }
      throw new Error(ERROR_MSG);
    }),
  KERNEL_PUBLIC_KEY: T.Optional(T.String()),
  LOG_LEVEL: T.Optional(T.String()),
});

export type Env = StaticDecode<typeof envSchema>;
