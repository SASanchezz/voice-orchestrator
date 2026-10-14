// The session panel's budget lines: a context meter, what the session and today cost, and at the critical level
// the offer to hand the session off to a fresh one.

import type { BudgetView, SessionView } from "../protocol.js";
import { isBusy } from "../running-tasks.js";
import {
  contextLine,
  isOverToday,
  type SessionBudget,
  sessionBudget,
  sessionCostLine,
  todayLine,
} from "../session-budget.js";
import { act } from "./api.js";
import { button, el } from "./dom.js";
import { store } from "./store.js";

const FULL_PERCENT = 100;
/** Sessions whose handoff summary is being written; the panel is redrawn often meanwhile. */
const handingOff = new Set<string>();

export function budgetLines(session: SessionView): HTMLDivElement[] {
  const budget = store.state.budget;
  const standing = sessionBudget(session, budget);
  const lines = [contextMeter(session, standing), costLine(session, standing, budget)];
  if (standing.contextLevel === "critical") lines.push(handoffOffer(session));
  return lines;
}

function contextMeter(session: SessionView, standing: SessionBudget): HTMLDivElement {
  const fill = el("div", { class: `budget-fill ${standing.contextLevel}` });
  fill.style.width = `${Math.min(standing.contextPercent, FULL_PERCENT)}%`;
  return el(
    "div",
    { class: "budget-row" },
    el("div", { class: "budget-meter", role: "presentation" }, fill),
    el("span", { class: `budget-text ${standing.contextLevel}` }, contextLine(session, standing)),
  );
}

function costLine(session: SessionView, standing: SessionBudget, budget: BudgetView): HTMLDivElement {
  return el(
    "div",
    { class: "budget-row muted" },
    el("span", { class: standing.overCost ? "budget-text warn" : "" }, sessionCostLine(session, budget)),
    el("span", { class: isOverToday(budget) ? "budget-text warn" : "" }, todayLine(budget)),
  );
}

function handoffOffer(session: SessionView): HTMLDivElement {
  const handOff = button(handingOff.has(session.id) ? "Writing handoff…" : "Hand off to a new session", "primary", () =>
    startHandoff(session, handOff),
  );
  handOff.disabled = isBusy(session) || handingOff.has(session.id);
  handOff.title = "The worker writes a summary; a new session starts from it, and this one stays as it is";
  const advice = isBusy(session) ? "Once it finishes, hand it off" : "Hand it off";
  return el(
    "div",
    { class: "budget-offer" },
    el("span", {}, `This session's context is nearly full, so each turn is expensive. ${advice} to a fresh session.`),
    handOff,
  );
}

function startHandoff(session: SessionView, handOff: HTMLButtonElement): void {
  handingOff.add(session.id);
  handOff.disabled = true;
  handOff.textContent = "Writing handoff…";
  void act(`/api/sessions/${session.id}/handoff`).finally(() => handingOff.delete(session.id));
}
