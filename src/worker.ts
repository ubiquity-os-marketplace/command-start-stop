import { Value } from "@sinclair/typebox/value";
import { startStopTask } from "./plugin";
import { Env, startStopSchema, startStopSettingsValidator } from "./types";
import manifest from "../manifest.json";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === "GET") {
        const url = new URL(request.url);
        if (url.pathname === "/manifest.json") {
          return new Response(JSON.stringify(manifest), {
            headers: { "content-type": "application/json" },
          });
        }
      }
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: `Only POST requests are supported.` }), {
          status: 405,
          headers: { "content-type": "application/json", Allow: "POST" },
        });
      }
      const contentType = request.headers.get("content-type");
      if (contentType !== "application/json") {
        return new Response(JSON.stringify({ error: `Error: ${contentType} is not a valid content type` }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const webhookPayload = await request.json();

      const settings = Value.Decode(startStopSchema, Value.Default(startStopSchema, webhookPayload.settings));

      if (!startStopSettingsValidator.test(settings)) {
        throw new Error("Invalid settings provided");
      }

      webhookPayload.settings = settings;
      await startStopTask(webhookPayload, env);
      return new Response(JSON.stringify("OK"), { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      return handleUncaughtError(error);
    }
  },
};

function handleUncaughtError(error: unknown) {
  console.error(error);
  const status = 500;
  return new Response(JSON.stringify({ error }), { status: status, headers: { "content-type": "application/json" } });
}
