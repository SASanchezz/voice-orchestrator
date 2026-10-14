import type { BudgetConfig } from "../config/budget-config.js";
import type { WorkerChat } from "../workers/worker-chat.js";
import { crossedLimit } from "./budget-levels.js";

/** A line in the session's chat when its cost, or today's, goes over the limit; shown, not spoken. */
export class CostAlerts {
  constructor(
    private chat: WorkerChat,
    private limits: Pick<BudgetConfig, "sessionCostUsd" | "dailyCostUsd">,
  ) {}

  sessionCostChanged(sessionId: string, beforeUsd: number, afterUsd: number): void {
    if (!crossedLimit(beforeUsd, afterUsd, this.limits.sessionCostUsd)) return;
    this.chat.say(sessionId, "status", `This session has now cost over its $${this.limits.sessionCostUsd} limit.`);
  }

  /** `sessionId` is the session whose spend took the day over the limit; the line goes to its chat. */
  dailyCostChanged(sessionId: string, beforeUsd: number, afterUsd: number): void {
    if (!crossedLimit(beforeUsd, afterUsd, this.limits.dailyCostUsd)) return;
    this.chat.say(
      sessionId,
      "status",
      `Today's spend across all sessions is over the $${this.limits.dailyCostUsd} daily limit.`,
    );
  }
}
