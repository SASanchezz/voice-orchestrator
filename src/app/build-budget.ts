import { resolve } from "node:path";
import { ContextAlerts } from "../budget/context-alerts.js";
import { ContextMeter } from "../budget/context-meter.js";
import { CostAlerts } from "../budget/cost-alerts.js";
import { DailySpend } from "../budget/daily-spend.js";
import { SpendLedger } from "../budget/spend-ledger.js";
import { STATE_DIR } from "../config/paths.js";
import type { WorkerChat } from "../workers/worker-chat.js";
import type { Core } from "./core.js";

/** How much sessions cost and how full their context gets, against the limits in config.yaml's budget. */
export interface BudgetParts {
  ledger: SpendLedger;
  meter: ContextMeter;
  daily: DailySpend;
}

export function buildBudget({ cfg, sessions, events }: Core, chat: WorkerChat): BudgetParts {
  const daily = new DailySpend(resolve(STATE_DIR, "spend.json"));
  const ledger = new SpendLedger(sessions, daily, new CostAlerts(chat, cfg.budget));
  const meter = new ContextMeter(sessions, cfg.budget, new ContextAlerts(chat, events, sessions));
  return { ledger, meter, daily };
}
