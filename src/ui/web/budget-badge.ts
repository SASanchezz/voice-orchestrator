// A session tab's badge: how full its context is once that's high, and its cost once it's over the limit.

import type { SessionView } from "../protocol.js";
import { badgeText, type SessionBudget, sessionBudget } from "../session-budget.js";
import { el } from "./dom.js";
import { store } from "./store.js";

export function budgetBadge(session: SessionView): HTMLSpanElement | "" {
  const standing = sessionBudget(session, store.state.budget);
  const text = badgeText(session, standing);
  if (!text) return "";
  const title = "Large sessions cost more with every turn; see the session panel";
  return el("span", { class: `budget-badge ${badgeLevel(standing)}`, title }, text);
}

/** Red when the context is critical; amber when it is high or the session is over its cost limit. */
export function badgeLevel(standing: SessionBudget): string {
  if (standing.contextLevel === "critical") return "critical";
  return standing.contextLevel === "warn" || standing.overCost ? "warn" : "ok";
}
