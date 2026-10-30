// The top bar's usage readout: what the selected project's account has left of its 5-hour and weekly limits.
// The server only learns this by asking, so the page polls it while in front.

import type { AccountUsageView } from "../plan-usage-views.js";
import { usageReadout, type UsageReadoutItem } from "../usage-readout.js";
import { fetchPlanUsage } from "./api.js";
import { byId, el } from "./dom.js";
import { store } from "./store.js";

const POLL_MS = 120_000;

let accounts: AccountUsageView[] = [];

export function wirePlanUsagePoll(): void {
  void refreshPlanUsage();
  setInterval(refreshWhileShown, POLL_MS);
  document.addEventListener("visibilitychange", refreshWhileShown);
}

export function renderPlanUsage(): void {
  const account = store.selectedProject()?.profile;
  const usage = accounts.find((candidate) => candidate.account === account);
  const items = usage ? usageReadout(usage, new Date()).map(readoutItem) : [];
  const readout = byId("plan-usage", HTMLElement);
  readout.hidden = !items.length;
  readout.title = `What the ${account} account has left of its plan`;
  readout.replaceChildren(...items);
}

function readoutItem({ label, percentText, level, title }: UsageReadoutItem): HTMLSpanElement {
  const percent = el("span", { class: `context-percent ${level}` }, percentText);
  return el("span", { class: "plan-usage-item", title }, `${label} `, percent, " left");
}

function refreshWhileShown(): void {
  if (document.visibilityState === "visible") void refreshPlanUsage();
}

async function refreshPlanUsage(): Promise<void> {
  try {
    accounts = await fetchPlanUsage();
    renderPlanUsage();
  } catch {
    // the server is restarting; the next poll catches up
  }
}
