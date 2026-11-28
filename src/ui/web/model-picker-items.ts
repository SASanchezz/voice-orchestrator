// What the chat's model picker shows: the chip's model and effort meter, and the panel's two columns, models on the
// left and thinking effort on the right, each with the session's current choice checked.

import { effortLabel, WORKER_EFFORT_IDS, type WorkerEffort } from "../../workers/worker-efforts.js";
import { modelLabel, WORKER_MODELS, type WorkerModelChoice } from "../../workers/worker-models.js";
import type { ProjectView, SessionView } from "../protocol.js";
import { act } from "./api.js";
import { button, el } from "./dom.js";
import { modelColourClass, projectModelOf, sessionEffortOf, sessionModelOf } from "./session-model.js";

const EFFORT_HINT = "How long Claude thinks before it answers. Higher is slower and uses more of your plan.";
/** Claude Code's settings name no effort: it picks one for the model by itself. */
const BUILT_IN_EFFORT_NOTE = "built-in";
const CHEVRON = "▾";

export function effortChipParts(project: ProjectView, session: SessionView): HTMLElement[] {
  const model = sessionModelOf(project, session);
  const effort = sessionEffortOf(project, session);
  return [
    modelDot(model),
    el("span", { class: "chip-model" }, modelLabel(model)),
    effortMeter(effort),
    el("span", { class: "chip-effort" }, effortLabel(effort)),
    el("span", { class: "chip-chevron", "aria-hidden": "true" }, CHEVRON),
  ];
}

export function modelPickerColumns(project: ProjectView, session: SessionView): HTMLElement[] {
  return [modelColumn(project, session), effortColumn(project, session)];
}

/** "Project's model" first: picking it drops the session's own choice. */
function modelColumn(project: ProjectView, session: SessionView): HTMLElement {
  const projectModel = projectModelOf(project);
  const useProject = pickerItem(
    [modelDot(projectModel), "Project's model", note(modelLabel(projectModel))],
    session.model === undefined,
    () => setModel(session),
  );
  const choices = WORKER_MODELS.map((choice) => modelItem(session, choice));
  return pickerColumn("Model", [useProject, ...choices]);
}

function modelItem(session: SessionView, { id, label }: WorkerModelChoice): HTMLButtonElement {
  return pickerItem([modelDot(id), label], session.model === id, () => setModel(session, id));
}

/** "Claude Code's setting" first, naming the effort it picks: picking it drops the session's own choice. */
function effortColumn(project: ProjectView, session: SessionView): HTMLElement {
  const parts = ["Claude Code's setting", claudeEffortNote(project)];
  const byDefault = pickerItem(parts, session.effort === undefined, () => setEffort(session));
  const levels = WORKER_EFFORT_IDS.map((effort) => effortItem(session, effort));
  const column = pickerColumn("Thinking effort", [byDefault, ...levels]);
  column.title = EFFORT_HINT;
  return column;
}

function claudeEffortNote({ claudeEffort }: ProjectView): HTMLSpanElement {
  return note(claudeEffort === undefined ? BUILT_IN_EFFORT_NOTE : effortLabel(claudeEffort));
}

function effortItem(session: SessionView, effort: WorkerEffort): HTMLButtonElement {
  const label = effortLabel(effort);
  return pickerItem([label, effortMeter(effort)], session.effort === effort, () => setEffort(session, effort));
}

function pickerColumn(heading: string, items: HTMLButtonElement[]): HTMLElement {
  return el(
    "div",
    { class: "model-picker-column", role: "group", "aria-label": heading },
    el("h3", {}, heading),
    ...items,
  );
}

function pickerItem(parts: (string | HTMLElement)[], isCurrent: boolean, onClick: () => void): HTMLButtonElement {
  const item = button("", "ghost model-picker-item", onClick);
  item.replaceChildren(...parts);
  item.setAttribute("role", "menuitemradio");
  item.setAttribute("aria-checked", String(isCurrent));
  return item;
}

/** Filled bars up to the level, as a phone's signal: none for the default, all five for Max. */
function effortMeter(effort: WorkerEffort | undefined): HTMLSpanElement {
  const filled = effort === undefined ? 0 : WORKER_EFFORT_IDS.indexOf(effort) + 1;
  const bars = WORKER_EFFORT_IDS.map((_level, index) => effortBar(index < filled));
  return el("span", { class: "effort-meter", "aria-hidden": "true" }, ...bars);
}

function effortBar(isFilled: boolean): HTMLSpanElement {
  return el("span", { class: isFilled ? "effort-bar filled" : "effort-bar" });
}

function modelDot(model: string | undefined): HTMLSpanElement {
  return el("span", { class: `model-dot ${modelColourClass(model)}`, "aria-hidden": "true" });
}

function note(text: string): HTMLSpanElement {
  return el("span", { class: "model-picker-note" }, text);
}

function setModel(session: SessionView, model?: string): void {
  void act(`/api/sessions/${session.id}/model`, { model });
}

function setEffort(session: SessionView, effort?: WorkerEffort): void {
  void act(`/api/sessions/${session.id}/effort`, { effort });
}
