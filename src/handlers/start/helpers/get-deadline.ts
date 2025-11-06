import { Context } from "../../../types/index";
import { options } from "./generate-assignment-comment";
import { calculateDurations } from "../../../utils/shared";

export function getDeadline(labels: Context<"issue_comment.created">["payload"]["issue"]["labels"] | undefined | null): string | null {
    if (!labels?.length) {
      throw new Error("No labels are set.");
    }
    const startTime = new Date().getTime();
    const duration: number = calculateDurations(labels).shift() ?? 0;
    if (!duration) return null;
    const endTime = new Date(startTime + duration * 1000);
    return endTime.toLocaleString("en-US", options);
  }