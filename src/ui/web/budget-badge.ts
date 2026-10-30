// A session tab's badge: a small bar with how full its context is; the tooltip spells out the tokens.

import type { SessionView } from "../protocol.js";
import { contextLine, contextPercentText, type SessionBudget, sessionBudget } from "../session-budget.js";
import { el } from "./dom.js";
import { store } from "./store.js";

const FULL_PERCENT = 100;

export function budgetBadge(session: SessionView): HTMLSpanElement | "" {
  const standing = sessionBudget(session, store.state.budget);
  const percent = contextPercentText(session, standing);
  if (!percent) return "";
  const title = contextLine(session, standing);
  return el("span", { class: "budget-badge", title }, ...contextMeter(standing, percent));
}

/** Green while low, amber when high, red when critical. */
function contextMeter(standing: SessionBudget, percent: string): HTMLSpanElement[] {
  const fill = el("span", { class: `context-fill ${standing.contextLevel}` });
  fill.style.width = `${Math.min(standing.contextPercent, FULL_PERCENT)}%`;
  const meter = el("span", { class: "context-meter" }, fill);
  return [meter, el("span", { class: `context-percent ${standing.contextLevel}` }, percent)];
}
