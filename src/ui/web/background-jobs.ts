// Above the message box: the commands and helper agents the shown session's worker left running in the background.
// Its reply may already be written, but the session stays busy until they report back; each line says what runs,
// on a stopwatch for how long, and the last line it printed, ticking every second.

import { isBusy } from "../running-tasks.js";
import type { BackgroundJobView } from "../session-protocol.js";
import { byId, el } from "./dom.js";
import { stopwatch } from "./stopwatch.js";
import { activeSession, store } from "./store.js";

const STRIP_ID = "background-jobs";
const TICK_MS = 1000;
const NO_OUTPUT_YET = "no output yet";

let ticker: number | undefined;

export function wireBackgroundJobs(): void {
  const strip = el("ul", { id: STRIP_ID, class: "background-jobs", "aria-label": "Running in the background" });
  strip.hidden = true;
  byId("composer", HTMLFormElement).before(strip);
}

export function renderBackgroundJobs(): void {
  const jobs = shownJobs();
  byId(STRIP_ID, HTMLElement).hidden = jobs.length === 0;
  if (jobs.length === 0) return stopTicking();
  showJobs(jobs);
  ticker ??= window.setInterval(() => showJobs(shownJobs()), TICK_MS);
}

/** Only while the session is busy: a stopped or finished run's jobs ended with it. */
function shownJobs(): BackgroundJobView[] {
  const project = store.selectedProject();
  const session = project ? activeSession(project) : undefined;
  if (!session || !isBusy(session)) return [];
  return session.backgroundJobs ?? [];
}

function showJobs(jobs: BackgroundJobView[]): void {
  byId(STRIP_ID, HTMLElement).replaceChildren(...jobs.map(jobLine));
}

function jobLine({ description, startedAt, step }: BackgroundJobView): HTMLLIElement {
  const line = el(
    "li",
    { class: "background-job" },
    stopwatch(startedAt),
    el("span", { class: "background-job-name" }, `In the background: ${description}`),
    el("span", { class: "background-job-step" }, step || NO_OUTPUT_YET),
  );
  line.title = step ? `Last output: ${step}` : "It has printed nothing yet.";
  return line;
}

function stopTicking(): void {
  window.clearInterval(ticker);
  ticker = undefined;
}
