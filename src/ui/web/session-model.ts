// Which Claude model a session's worker runs on: a badge on its tab, and the choices in its right-click menu.

import { listedModelOf, modelLabel, WORKER_MODELS, type WorkerModelChoice } from "../../workers/worker-models.js";
import type { ProjectView, SessionView } from "../protocol.js";
import { act } from "./api.js";
import { button, el } from "./dom.js";

const PROJECT_MODEL_LABEL = "Project's model";
const CHECKED = "✓";
const UNCHECKED = "\u2003"; // an em space, as wide as the check, keeps the labels lined up

/** The session's own model, else its project's; unset, Claude Code's built-in default. */
export function sessionModelOf(project: ProjectView, session: SessionView): string | undefined {
  return session.model ?? projectModelOf(project);
}

/** The one config.yaml sets for the project, else the one Claude Code's settings pick. */
function projectModelOf(project: ProjectView): string | undefined {
  return project.model ?? project.claudeModel;
}

export function modelBadge(project: ProjectView, session: SessionView): HTMLSpanElement {
  const model = sessionModelOf(project, session);
  const label = modelLabel(model);
  const title = `Runs on ${label} (${modelOrigin(project, session)}). Right-click the tab to change it.`;
  return el("span", { class: `model-badge ${modelColourClass(model)}`, title }, label);
}

function modelOrigin(project: ProjectView, session: SessionView): string {
  if (session.model) return "chosen for this session";
  if (project.model) return "the project's model";
  return "Claude Code's default";
}

/** Each listed model has its own colour, so sessions on different models tell apart at a glance. */
function modelColourClass(model: string | undefined): string {
  const listed = model === undefined ? undefined : listedModelOf(model);
  return listed ? `model-${listed.id}` : "";
}

/** One item per model, the session's own marked; "Project's model" drops the session's choice. */
export function modelMenuItems(project: ProjectView, session: SessionView, onPick: () => void): HTMLButtonElement[] {
  const projectLabel = `${PROJECT_MODEL_LABEL} (${modelLabel(projectModelOf(project))})`;
  const useProject = modelItem(projectLabel, session.model === undefined, () => setModel(session, onPick));
  const choices = WORKER_MODELS.map((choice) => choiceItem(session, choice, onPick));
  return [useProject, ...choices];
}

function choiceItem(session: SessionView, { id, label }: WorkerModelChoice, onPick: () => void): HTMLButtonElement {
  return modelItem(label, session.model === id, () => setModel(session, onPick, id));
}

function modelItem(label: string, isCurrent: boolean, onClick: () => void): HTMLButtonElement {
  const item = button(`${isCurrent ? CHECKED : UNCHECKED} ${label}`, "ghost session-menu-item model-item", onClick);
  item.setAttribute("role", "menuitemradio");
  item.setAttribute("aria-checked", String(isCurrent));
  return item;
}

function setModel(session: SessionView, onPick: () => void, model?: string): void {
  onPick();
  void act(`/api/sessions/${session.id}/model`, { model });
}
