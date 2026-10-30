// Where to-do items run: a line per run naming its project and session, with how far it got; the place opens that
// session's chat. "Running now" gathers the runs still in progress, across every project.

import { isActive, type PlacedRun, type TodoRunState } from "../todo-run-state.js";
import { button, el } from "./dom.js";
import { openSessionById } from "./session-link.js";
import { STATUS_LABELS } from "./store.js";

const RUN_LABELS: Record<TodoRunState, string> = {
  ...STATUS_LABELS,
  queued: "queued",
  sent: "sent",
  closed: "session closed",
};

export function activeRuns(runs: PlacedRun[]): PlacedRun[] {
  return runs.filter((placed) => isActive(placed.state));
}

/** An item's runs, newest first. */
export function runList(runs: PlacedRun[]): HTMLUListElement[] {
  if (!runs.length) return [];
  return [el("ul", { class: "todo-runs" }, ...runs.toReversed().map(runLine))];
}

/** The runs in progress, each with the item it runs. */
export function runningNow(runs: PlacedRun[]): HTMLElement[] {
  const active = activeRuns(runs);
  if (!active.length) return [];
  const head = el("h3", { class: "todo-section-head" }, `Running now (${active.length})`);
  return [el("section", { class: "todo-running" }, head, el("ul", { class: "todo-runs" }, ...active.map(runningLine)))];
}

function runningLine(placed: PlacedRun): HTMLLIElement {
  const line = runLine(placed);
  line.append(el("span", { class: "todo-run-item" }, `#${placed.item.id} ${placed.item.title}`));
  return line;
}

function runLine(placed: PlacedRun): HTMLLIElement {
  const dot = el("span", { class: `dot ${placed.state}` });
  const state = el("span", { class: "todo-run-state" }, RUN_LABELS[placed.state]);
  return el("li", { class: "todo-run" }, dot, runPlace(placed), state);
}

/** "webshop · session 2", which opens that session; a closed session leaves just its project. */
function runPlace({ run, session }: PlacedRun): HTMLElement {
  if (!session) return el("span", { class: "muted" }, run.project);
  const open = (): void => void openSessionById(session.id);
  const place = button(`${run.project} · session ${session.number}`, "link session-link", open);
  place.title = "Show this session's chat";
  return place;
}
