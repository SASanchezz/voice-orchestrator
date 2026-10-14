// What the budget tests share: a fresh registry with one webshop session, and what its alerts said.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_BUDGET } from "../config/budget-config.js";
import { setStateDir } from "../config/paths.js";
import { type AppEvent, AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import type { Sessions } from "../registry/sessions.js";
import { type SessionMessage, WorkerChat } from "../workers/worker-chat.js";
import { ContextAlerts } from "./context-alerts.js";
import { ContextMeter } from "./context-meter.js";
import { CostAlerts } from "./cost-alerts.js";
import { DailySpend } from "./daily-spend.js";
import { SpendLedger } from "./spend-ledger.js";

export interface BudgetFixture {
  sessions: Sessions;
  sessionId: string;
  meter: ContextMeter;
  ledger: SpendLedger;
  daily: DailySpend;
  /** The chat lines the alerts wrote. */
  said: string[];
  /** The events the alerts emitted. */
  emitted: AppEvent[];
}

export function budgetFixture(): BudgetFixture {
  const dir = mkdtempSync(join(tmpdir(), "vo-budget-"));
  setStateDir(dir);
  const events = new AppEvents();
  const { registry, sessions } = openRegistry({ webshop: "personal" }, events);
  const chat = new WorkerChat();
  const said: string[] = [];
  const emitted: AppEvent[] = [];
  chat.on("message", (m: SessionMessage) => said.push(m.text));
  events.on("event", (e: AppEvent) => emitted.push(e));
  const daily = new DailySpend(join(dir, "spend.json"));
  const meter = new ContextMeter(sessions, DEFAULT_BUDGET, new ContextAlerts(chat, events, sessions));
  const ledger = new SpendLedger(sessions, daily, new CostAlerts(chat, DEFAULT_BUDGET));
  return { sessions, sessionId: registry.activeSession("webshop").id, meter, ledger, daily, said, emitted };
}
