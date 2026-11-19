// The Messages view checks the messengers' setup by itself when it opens, at most every couple of minutes, and shows
// the outcome as one pill: green when nothing fails, red when something does. The pill opens the details; Check again
// asks once more.

import type { SourceCheckup } from "../reply-checkup-views.js";
import { byId, el } from "./dom.js";
import { fetchReplyCheckup } from "./reply-api.js";
import { renderSetupState, resultsOf, setupStateOf } from "./reply-checkup-render.js";

const RECHECK_AFTER_MS = 120_000;

let results: SourceCheckup[] | undefined;
let checkedAt = 0;
let running: Promise<void> | undefined;

export function wireReplyCheckup(): void {
  for (const pill of document.querySelectorAll(".reply-setup-status"))
    pill.addEventListener("click", () => void openCheckup());
  byId("reply-checkup-again", HTMLButtonElement).addEventListener("click", () => void runCheckup());
}

/** Called whenever the Messages view shows; checks again only once the last outcome is a while old. */
export function checkSetupWhenStale(): void {
  if (running || Date.now() - checkedAt < RECHECK_AFTER_MS) return;
  void runCheckup();
}

async function openCheckup(): Promise<void> {
  byId("reply-checkup-dialog", HTMLDialogElement).showModal();
  if (results && !running) showResults(results);
  else await runCheckup(); // joins a check already under way
}

async function runCheckup(): Promise<void> {
  running ??= checkNow().finally(() => (running = undefined));
  await running;
}

async function checkNow(): Promise<void> {
  checkedAt = Date.now();
  renderSetupState("checking");
  showNote("Checking with Slack and Telegram…");
  try {
    results = await fetchReplyCheckup();
    showResults(results);
    renderSetupState(setupStateOf(results));
  } catch {
    renderSetupState("unknown");
    showNote("The app didn't answer; try again in a moment.");
  }
}

function showResults(sources: SourceCheckup[]): void {
  byId("reply-checkup-results", HTMLElement).replaceChildren(...resultsOf(sources));
}

function showNote(note: string): void {
  byId("reply-checkup-results", HTMLElement).replaceChildren(el("p", { class: "reply-checkup-busy" }, note));
}
