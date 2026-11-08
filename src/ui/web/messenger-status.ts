// ⚙ › Messengers: which messengers are connected, beside the button and atop its dialog. Checked again each time
// the settings menu or the dialog opens, as a login in the terminal can change it at any time, and every few
// seconds while Telegram is still being asked.

import type { MessengerStatusView } from "../messenger-status-views.js";
import { fetchMessengerStatus } from "./api.js";
import { byId, el } from "./dom.js";

const STATE_WORDS = {
  connected: "connected",
  checking: "checking…",
  failed: "not working",
  half: "not ready",
  off: "not set up",
} as const;
/** While Telegram is being asked at startup, the status is read again this often until it answers. */
const CHECKING_POLL_MS = 3000;

export function wireMessengerStatus(): void {
  const settings = byId("settings", HTMLDetailsElement);
  settings.addEventListener("toggle", () => {
    if (settings.open) void refreshMessengerStatus();
  });
  void refreshMessengerStatus();
}

export async function refreshMessengerStatus(): Promise<void> {
  try {
    renderMessengerStatus(await fetchMessengerStatus());
  } catch {
    // the server is restarting; the next opening checks again
  }
}

function renderMessengerStatus(messengers: MessengerStatusView[]): void {
  byId("messenger-status", HTMLElement).replaceChildren(...messengers.map(statusChip));
  byId("messenger-status-list", HTMLElement).replaceChildren(...messengers.map(statusLine));
  if (messengers.some(isChecking)) setTimeout(() => void refreshMessengerStatus(), CHECKING_POLL_MS);
}

function isChecking(messenger: MessengerStatusView): boolean {
  return messenger.state === "checking";
}

function statusChip({ name, state, hint }: MessengerStatusView): HTMLSpanElement {
  return el("span", { class: `messenger-chip ${state}`, title: `${name}: ${hint}` }, name);
}

function statusLine({ name, state, hint }: MessengerStatusView): HTMLLIElement {
  const label = el("span", { class: `messenger-chip ${state}` }, `${name}: ${STATE_WORDS[state]}`);
  return el("li", {}, label, " ", el("span", { class: "muted" }, hint));
}
