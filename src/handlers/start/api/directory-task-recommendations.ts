import { Context } from "../../../types";
import { ShallowContext } from "./helpers/context-builder";
import { getRecommendations } from "./helpers/recommendations";

/**
 * Handles the recommendation flow when no issueUrl is provided.
 * Uses embeddings to find similar issues based on user's prior work.
 */
export async function handleRecommendations({
  context,
  options,
}: {
  context: Context | ShallowContext;
  options?: { topK?: number; threshold?: number };
}): Promise<Response> {
  try {
    const recommendations = await getRecommendations({ context, options });

    if (recommendations.length === 0) {
      return Response.json({ ok: true, recommendations: [], note: "No prior embeddings found for user" }, { status: 200 });
    }

    return Response.json({ ok: true, recommendations }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embeddings search failed";
    return Response.json({ ok: false, reasons: [message] }, { status: 500 });
  }
}
