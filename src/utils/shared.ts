import ms from "ms";
import { Context } from "../types/context";

export function calculateDurations(labels: Context<"issue_comment.created">["payload"]["issue"]["labels"]): number[] {
  // from shortest to longest
  const durations: number[] = [];

  labels.forEach((label) => {
    const labelName = (typeof label === "string" ? label : label?.name)?.trim();
    if (!labelName || !labelName.toLowerCase().startsWith("time:")) return;

    const normalizedEstimate = labelName
      .replace(/^time:\s*/i, "")
      .replace(/^<\s*/, "")
      .trim();
    const matches = normalizedEstimate.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
    if (!matches || matches.length < 3) return;

    const durationMs = ms(`${matches[1]} ${matches[2].toLowerCase()}`);
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) return;

    durations.push(durationMs / 1000);
  });

  return durations.sort((a, b) => a - b);
}
