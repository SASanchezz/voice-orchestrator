// Which Claude model a session's worker runs on, and how hard it thinks: a badge on its tab, and the labels and
// colours the chat's model picker shows.

import { effortLabel, type WorkerEffort } from "../../workers/worker-efforts.js";
import { listedModelOf, modelLabel } from "../../workers/worker-models.js";
import type { ProjectView, SessionView } from "../protocol.js";
import { el } from "./dom.js";

/** The session's own model, else its project's; unset, Claude Code's built-in default. */
export function sessionModelOf(project: ProjectView, session: SessionView): string | undefined {
  return session.model ?? projectModelOf(project);
}

/** The session's own effort, else the one Claude Code's settings pick; unset, Claude Code's built-in default. */
export function sessionEffortOf(project: ProjectView, session: SessionView): WorkerEffort | undefined {
  return session.effort ?? project.claudeEffort;
}

/** The one config.yaml sets for the project, else the one Claude Code's settings pick. */
export function projectModelOf(project: ProjectView): string | undefined {
  return project.model ?? project.claudeModel;
}

export function modelBadge(project: ProjectView, session: SessionView): HTMLSpanElement {
  const model = sessionModelOf(project, session);
  const label = modelLabel(model);
  const effort = effortLabel(sessionEffortOf(project, session));
  const title = `Runs on ${label} (${modelOrigin(project, session)}), ${effort} effort. Change both from the chat's model picker.`;
  return el("span", { class: `model-badge ${modelColourClass(model)}`, title }, label);
}

function modelOrigin(project: ProjectView, session: SessionView): string {
  if (session.model) return "chosen for this session";
  if (project.model) return "the project's model";
  return "Claude Code's default";
}

/** Each listed model has its own colour, so sessions on different models tell apart at a glance. */
export function modelColourClass(model: string | undefined): string {
  const listed = model === undefined ? undefined : listedModelOf(model);
  return listed ? `model-${listed.id}` : "";
}
