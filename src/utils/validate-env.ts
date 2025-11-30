import { Value } from "@sinclair/typebox/value";
import { Context as HonoContext } from "hono";
import { env as honoEnv } from "hono/adapter";
import { envSchema } from "../types/index";

export function validateReqEnv(c: HonoContext) {
  try {
    const runtimeEnv = honoEnv(c);
    const cleanEnv = Value.Clean(envSchema, Value.Default(envSchema, runtimeEnv));
    if (!Value.Check(envSchema, cleanEnv)) {
      throw new Error("Environment validation failed");
    }
    return Value.Decode(envSchema, cleanEnv);
  } catch (error) {
    console.error("Environment validation failed during public API request", { error });
    return new Response(
      JSON.stringify({
        error: {
          code: "invalid_environment",
          message: "Environment variables are misconfigured.",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
