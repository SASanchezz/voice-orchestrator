import type { Sessions } from "../registry/sessions.js";
import type { CostAlerts } from "./cost-alerts.js";
import type { DailySpend } from "./daily-spend.js";
import { newSpendUsd } from "./run-cost.js";

/** Where the money workers spend is counted: per session in the registry, per day in state/spend.json. */
export class SpendLedger {
  constructor(
    private sessions: Sessions,
    private daily: DailySpend,
    private alerts: CostAlerts,
  ) {}

  /** The SDK's latest running total for the session's conversation; only what it grew by is new spend. */
  charge(sessionId: string, runningTotalUsd: number): void {
    this.spend(sessionId, this.newSpend(sessionId, runningTotalUsd));
    this.sessions.updateSession(sessionId, { conversationCostUsd: runningTotalUsd });
  }

  /** A fork (a handoff summary) continues the conversation's total, but the conversation itself goes on from its own. */
  chargeFork(sessionId: string, forkTotalUsd: number): void {
    this.spend(sessionId, this.newSpend(sessionId, forkTotalUsd));
  }

  private newSpend(sessionId: string, runningTotalUsd: number): number {
    return newSpendUsd(runningTotalUsd, this.sessions.session(sessionId).conversationCostUsd ?? 0);
  }

  private spend(sessionId: string, usd: number): void {
    const sessionBefore = this.sessions.session(sessionId).costUsd;
    const dayBefore = this.daily.spentOn();
    this.sessions.updateSession(sessionId, { costUsd: sessionBefore + usd });
    this.daily.add(usd);
    this.alerts.sessionCostChanged(sessionId, sessionBefore, sessionBefore + usd);
    this.alerts.dailyCostChanged(sessionId, dayBefore, dayBefore + usd);
  }
}
