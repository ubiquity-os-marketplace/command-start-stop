import { Context } from "../../types/index";
import { calculateDurations } from "../../utils/shared";

export const options: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  timeZone: "UTC",
  timeZoneName: "short",
};

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

export async function generateAssignmentComment(context: Context, issueCreatedAt: string, issueNumber: number, senderId: number, deadline: string | null) {
  const startTime = new Date().getTime();

  return {
    daysElapsedSinceTaskCreation: Math.floor((startTime - new Date(issueCreatedAt).getTime()) / 1000 / 60 / 60 / 24),
    deadline: deadline ?? null,
    registeredWallet:
      (await context.adapters.supabase.user.getWalletByUserId(senderId, issueNumber)) ||
      `

> [!WARNING]
> Register your wallet to be eligible for rewards.

`,
    tips: `
> [!TIP]
> - Use <code>/wallet 0x0000...0000</code> if you want to update your registered payment wallet address.
> - Be sure to open a draft pull request as soon as possible to communicate updates on your progress.
> - Be sure to provide timely updates to us when requested, or you will be automatically unassigned from the task.`,
  };
}
