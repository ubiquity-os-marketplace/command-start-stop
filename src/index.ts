import handler from "./deno.ts";

Deno.serve(handler.fetch);
