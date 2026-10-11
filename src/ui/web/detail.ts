// The right panel: the selected project's active session, with its controls and history.

import type { ProjectView, SessionView } from "../protocol.js";
import { el, button, byId, collapsible, formatTime } from "./dom.js";
import { act } from "./api.js";
import { store, activeSession, isBusy, STATUS_LABELS } from "./store.js";

export function renderDetail() {
  const panel = byId("detail");
  const project = store.selectedProject();
  if (!project) {
    delete panel.dataset.version;
    return panel.replaceChildren(el("p", { class: "empty" }, "Select a project to chat with its sessions and see their history."));
  }
  const session = activeSession(project);
  // rebuild only when there is something new, so open details survive live updates
  const version = `${session.id}#${session.history.length}`;
  if (panel.dataset.version === version) return updateDetailHead(project, session);
  panel.dataset.version = version;
  panel.replaceChildren(detailHead(project, session), historySection(session));
}

function detailHead(project: ProjectView, session: SessionView): HTMLDivElement {
  return el("div", { class: "detail-head", id: "detail-head" }, ...detailHeadContent(project, session));
}

function updateDetailHead(project: ProjectView, session: SessionView) {
  document.getElementById("detail-head")?.replaceChildren(...detailHeadContent(project, session));
}

function detailHeadContent(project: ProjectView, session: SessionView): HTMLDivElement[] {
  const stop = button("Stop", "ghost", () => void act(`/api/sessions/${session.id}/stop`));
  stop.disabled = !isBusy(session);
  const clear = button("Clear session", "ghost", () => clearSession(session));
  clear.title = "Delete this session's messages, history and worker conversation, keeping the session open";
  const lines = [
    el("div", { class: "detail-title" },
      el("span", { class: `dot ${session.status}` }),
      el("h2", {}, `${project.name} · session ${session.number}`),
      el("span", { class: "badge" }, `${project.profile} account`)),
    el("div", { class: "section-row" },
      el("span", { class: "muted" }, `${STATUS_LABELS[session.status]} · $${session.costUsd.toFixed(2)} spent`),
      el("span", { class: "row-actions" }, stop, clear)),
  ];
  if (session.task && isBusy(session))
    lines.push(el("div", {}, el("span", { class: "muted" }, "Task: "), session.task));
  if (session.status === "failed" && session.lastError) lines.push(el("div", { class: "outcome failed" }, session.lastError));
  return lines;
}

function clearSession(session: SessionView) {
  const warning = `Clear session ${session.number}?${isBusy(session) ? " Its worker will be stopped." : ""} Its messages, history and worker conversation are deleted; the session stays open.`;
  if (confirm(warning)) void act(`/api/sessions/${session.id}/clear`);
}

function historySection(session: SessionView): HTMLDivElement {
  const items = [...session.history].reverse().map((h) =>
    el("li", { class: "history-item" },
      el("div", { class: "entry-meta" }, el("span", { class: `outcome ${h.outcome}` }, h.outcome), el("span", {}, formatTime(h.finishedAt))),
      el("div", { class: "history-task" }, h.task),
      collapsible("Result", h.result)));
  return el("div", { class: "detail-section" },
    el("h3", { class: "section-title" }, "History"),
    items.length ? el("ol", { class: "history" }, ...items) : el("p", { class: "muted" }, "No finished tasks yet."));
}
