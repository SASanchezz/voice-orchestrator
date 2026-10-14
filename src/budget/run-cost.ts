/**
 * What was spent since the SDK last reported, from its running total for the conversation. A resumed conversation's
 * total already includes its earlier tasks; a total below the last one seen means the SDK started counting over.
 */
export function newSpendUsd(runningTotalUsd: number, seenTotalUsd: number): number {
  return runningTotalUsd >= seenTotalUsd ? runningTotalUsd - seenTotalUsd : runningTotalUsd;
}
