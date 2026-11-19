// How the setup checkup shows: a status pill (green when nothing fails, red when something does), and the dialog,
// where each messenger lists what needs a look first and folds the checks that passed.

import type { CheckStatus, SetupCheck, SourceCheckup } from "../reply-checkup-views.js";
import { copyButton, el } from "./dom.js";

const ICONS: Record<CheckStatus, string> = { ok: "✓", warn: "!", fail: "✕" };
const NOTHING_SET_UP = "No messenger is under messages in config/config.yaml. ⚙ › Messengers shows how to add one.";

/** checking: under way; unknown: the app didn't answer. */
export type SetupState = "checking" | "connected" | "failing" | "unknown";

const STATE_LABELS: Record<SetupState, string> = {
  checking: "Checking setup…",
  connected: "Connected",
  failing: "Setup needs a look",
  unknown: "Setup unknown",
};

export function setupStateOf(sources: SourceCheckup[]): SetupState {
  const isFailing = sources.some((source) => source.checks.some((check) => check.status === "fail"));
  return sources.length && !isFailing ? "connected" : "failing";
}

/** Every status pill on the page: the list's header, and the "caught up" screen. */
export function renderSetupState(state: SetupState): void {
  for (const pill of document.querySelectorAll<HTMLElement>(".reply-setup-status")) {
    pill.dataset.state = state;
    pill.textContent = STATE_LABELS[state];
    pill.title = state === "connected" ? "Slack and Telegram look right; click for details" : "Click for details";
  }
}

export function resultsOf(sources: SourceCheckup[]): HTMLElement[] {
  return sources.length ? sources.map(sourceSection) : [el("p", {}, NOTHING_SET_UP)];
}

function sourceSection({ source, checks }: SourceCheckup): HTMLElement {
  const toLook = checks.filter((check) => check.status !== "ok");
  const passed = checks.filter((check) => check.status === "ok");
  const badge = el(
    "span",
    { class: `reply-checkup-summary ${toLook.length ? "warn" : "ok"}` },
    summaryOf(toLook.length),
  );
  const section = el("section", { class: "reply-checkup-source" }, el("h3", {}, source, badge));
  if (toLook.length) section.append(el("ul", {}, ...toLook.map(checkLine)));
  if (passed.length) section.append(passedFold(passed, toLook.length === 0));
  return section;
}

function summaryOf(toLook: number): string {
  if (!toLook) return "All good";
  return toLook === 1 ? "1 to look at" : `${toLook} to look at`;
}

/** The checks that passed, folded unless there is nothing else to show. */
function passedFold(passed: SetupCheck[], isOpen: boolean): HTMLDetailsElement {
  const label = passed.length === 1 ? "1 check passed" : `${passed.length} checks passed`;
  const fold = el(
    "details",
    { class: "reply-checkup-passed" },
    el("summary", {}, label),
    el("ul", {}, ...passed.map(checkLine)),
  );
  fold.open = isOpen;
  return fold;
}

function checkLine({ label, status, detail, fix, command }: SetupCheck): HTMLLIElement {
  const icon = el("span", { class: `reply-checkup-icon ${status}`, "aria-label": status }, ICONS[status]);
  const text = el("div", { class: "reply-checkup-text" }, el("strong", {}, label), el("p", {}, detail));
  if (status !== "ok" && fix) text.append(el("p", { class: "reply-checkup-fix" }, fix));
  if (status !== "ok" && command) text.append(commandLine(command));
  return el("li", { class: status }, icon, text);
}

function commandLine(command: string): HTMLElement {
  return el(
    "div",
    { class: "reply-checkup-command" },
    el("code", {}, command),
    copyButton(command, "Copy the command"),
  );
}
