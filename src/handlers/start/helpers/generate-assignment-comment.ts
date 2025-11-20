import { Context } from "../../../types/index";
import { StartEligibilityResult } from "../api/helpers/types";

export const options: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  timeZone: "UTC",
  timeZoneName: "short",
};

export async function generateAssignmentComment({
  context,
  issueCreatedAt,
  issueNumber,
  senderId,
  eligibility,
}: {
  context: Context;
  issueCreatedAt: string;
  issueNumber: number;
  senderId: number;
  eligibility: StartEligibilityResult;
}) {
  const startTime = new Date().getTime();
  const wallet = eligibility.computed.wallet || (await context.adapters.supabase.user.getWalletByUserId(senderId, issueNumber));

  const registerWalletText = `

> [!WARNING]
> Register your wallet to be eligible for rewards.

`;

  return {
    daysElapsedSinceTaskCreation: Math.floor((startTime - new Date(issueCreatedAt).getTime()) / 1000 / 60 / 60 / 24),
    deadline: eligibility.computed.deadline ?? null,
    registeredWallet: wallet || registerWalletText,
    warnings: eligibility.warnings || [],
    tips: `
> [!TIP]
> - Use <code>/wallet 0x0000...0000</code> if you want to update your registered payment wallet address.
> - Be sure to open a draft pull request as soon as possible to communicate updates on your progress.
> - Be sure to provide timely updates to us when requested, or you will be automatically unassigned from the task.`,
  };
}
