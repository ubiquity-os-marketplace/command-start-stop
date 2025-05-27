import ms from "ms";
import { Context } from "../types/index.ts";

export function calculateDurations(labels: Context<"issue_comment.created">["payload"]["issue"]["labels"]): number[] {
  // from shortest to longest
  const durations: number[] = [];

  labels.forEach((label) => {
    const matches = label?.name.match(/<(\d+)\s*(\w+)/);
    if (matches && matches.length >= 3) {
      const number = parseInt(matches[1]);
      const unit = matches[2];
      const duration = ms(`${number} ${unit}`) / 1000;
      durations.push(duration);
    }
  });

  return durations.sort((a, b) => a - b);
}
