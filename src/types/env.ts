import { StaticDecode, Type as T } from "@sinclair/typebox";

const ERROR_MSG = "Invalid BOT_USER_ID";
export const envSchema = T.Object({
  APP_ID: T.String({ minLength: 1 }),
  APP_PRIVATE_KEY: T.String({ minLength: 1 }),
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
  XP_SERVICE_BASE_URL: T.Optional(T.String()),
  /**
   *  Comma-separated list of allowed origins for public API CORS. Example: "http://localhost:3000,http://127.0.0.1:5173"
   */
  PUBLIC_API_ALLOWED_ORIGINS: T.Optional(T.String()),
  NODE_ENV: T.Optional(T.String()),
});

export type Env = StaticDecode<typeof envSchema>;
