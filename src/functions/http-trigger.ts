import { app } from "@azure/functions";
import { azureHonoHandler } from "@marplex/hono-azurefunc-adapter";
import worker from "../worker";

app.http("http-trigger", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "{*proxy}",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: azureHonoHandler(worker.fetch as any),
});
