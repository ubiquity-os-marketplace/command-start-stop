import { createClient } from "@supabase/supabase-js";
import { Context } from "../../../../types/context";
import { ShallowContext } from "./context-builder";

export type Recommendation = {
  issueUrl: string;
  similarity: number;
  repo: string;
  org: string;
  title: string;
};

export async function getRecommendations({
  context,
  options,
}: {
  context: Context | ShallowContext;
  options?: { topK?: number; threshold?: number };
}): Promise<Recommendation[]> {
  const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);
  const threshold = options?.threshold ?? 0.6; // 60% similarity threshold
  const topK = options?.topK ?? 5;
  const {
    octokit,
    payload: { sender },
  } = context;

  // Get user's completed/authored issues with embeddings
  // filter out issues that have assignees
  const { data: authored } = await supabase.from("issues").select("embedding,payload").eq("author_id", sender?.id).limit(100);

  const vectors = (authored || [])
    .map((r) => {
      try {
        return JSON.parse(r.embedding);
      } catch {
        return null;
      }
    })
    .filter((v: number[] | null): v is number[] => Array.isArray(v) && v.length > 0);

  if (!vectors.length) {
    console.error("No embeddings found for user", { userId: sender?.id });
    return [];
  }

  // query embedding is the average of the vectors
  const queryEmbedding = vectors.reduce((acc, v) => acc.map((x, i) => x + v[i]), new Array(vectors[0].length).fill(0));
  queryEmbedding.forEach((v, i) => {
    queryEmbedding[i] = v / vectors.length;
  });

  // Find similar issues
  const { data: similar, error } = await supabase.rpc("find_similar_issues_annotate", {
    current_id: `user-${sender?.id}`,
    query_embedding: queryEmbedding,
    threshold,
    top_k: topK,
  });

  if (error || !Array.isArray(similar)) {
    console.error("Embeddings search failed", { error, similar });
    throw new Error("Embeddings search failed");
  }

  // Build candidate list with filters (open/unassigned issues only)
  const results: Recommendation[] = [];

  for (const row of similar as Array<{ issue_id: string; similarity: number }>) {
    const { data: rec } = await supabase.from("issues").select("payload").eq("id", row.issue_id).maybeSingle();
    const payload = JSON.parse(rec?.payload);
    const org = payload?.repository?.owner?.login;
    const repo = payload?.repository?.name;
    const number = payload?.number ?? payload?.issue?.number;

    if (!org || !repo || !number || payload?.assignees?.length) {
      continue;
    }

    try {
      const issue = (await octokit.rest.issues.get({ owner: org, repo, issue_number: number })).data as Context<"issue_comment.created">["payload"]["issue"];

      // const isOpen = issue.state === "open";
      // const isUnassigned = !(issue.assignees && issue.assignees.length);

      // if (isOpen && isUnassigned) {
      const href = `https://www.github.com/${org}/${repo}/issues/${number}`;
      results.push({ issueUrl: href, similarity: row.similarity, repo, org, title: issue.title });
      // }
    } catch (err) {
      // Skip issues we can't access
      console.warn(`Failed to fetch issue ${org}/${repo}#${number}:`, err);
    }
  }

  return results;
}
