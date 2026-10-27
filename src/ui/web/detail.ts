// The right panel: the selected project's active session, with its controls and history; your to-do list otherwise.

import { shortFolder } from "../folder-path.js";
import type { ProjectView, SessionView } from "../protocol.js";
import { isBusy } from "../running-tasks.js";
import { act } from "./api.js";
import { budgetLines } from "./budget-panel.js";
import { button, byId, collapsible, copyButton, el, formatWhen } from "./dom.js";
import { markdownView } from "./markdown-view.js";
import { queueLines } from "./queue-list.js";
import { activeSession, STATUS_LABELS, store } from "./store.js";
import { renderTodoPanel } from "./todo-panel.js";

export function renderDetail(): void {
  const panel = byId("detail", HTMLElement);
  const project = store.selectedProject();
  if (!project) return renderTodoPanel(panel);
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

function updateDetailHead(project: ProjectView, session: SessionView): void {
  document.getElementById("detail-head")?.replaceChildren(...detailHeadContent(project, session));
}

function detailHeadContent(project: ProjectView, session: SessionView): HTMLDivElement[] {
  const lines = [titleLine(project, session), folderLine(project), statusLine(session), ...budgetLines(session)];
  if (session.task && isBusy(session))
    lines.push(el("div", {}, el("span", { class: "muted" }, "Task: "), session.task));
  lines.push(...queueLines(session));
  if (session.status === "failed" && session.lastError)
    lines.push(el("div", { class: "outcome failed" }, session.lastError));
  return lines;
}

function titleLine(project: ProjectView, session: SessionView): HTMLDivElement {
  return el(
    "div",
    { class: "detail-title" },
    el("span", { class: `dot ${session.status}` }),
    el("h2", {}, `${project.name} · session ${session.number}`),
    el("span", { class: "badge" }, `${project.profile} account`),
  );
}

function folderLine(project: ProjectView): HTMLDivElement {
  const copy = copyButton(project.folder, "Copy the full folder path");
  return el(
    "div",
    { class: "section-row detail-folder" },
    el("code", { class: "folder-path", title: project.folder }, shortFolder(project.folderFromHome)),
    copy,
  );
}

function statusLine(session: SessionView): HTMLDivElement {
  const clear = button("Clear session", "ghost", () => clearSession(session));
  clear.title = "Delete this session's messages, history and worker conversation, keeping the session open";
  const spent = `${STATUS_LABELS[session.status]} · $${session.costUsd.toFixed(2)} spent`;
  return el(
    "div",
    { class: "section-row" },
    el("span", { class: "muted" }, spent),
    el("span", { class: "row-actions" }, clear),
  );
}

function clearSession(session: SessionView): void {
  const warning = `Clear session ${session.number}?${isBusy(session) ? " Its worker will be stopped." : ""} Its messages, history and worker conversation are deleted; the session stays open.`;
  if (confirm(warning)) void act(`/api/sessions/${session.id}/clear`);
}

function historySection(session: SessionView): HTMLDivElement {
  const items = session.history.toReversed().map(historyItem);
  return el(
    "div",
    { class: "detail-section" },
    el("h3", { class: "section-title" }, "History"),
    items.length ? el("ol", { class: "history" }, ...items) : el("p", { class: "muted" }, "No finished tasks yet."),
  );
}

function historyItem(h: SessionView["history"][number]): HTMLLIElement {
  return el(
    "li",
    { class: "history-item" },
    el(
      "div",
      { class: "entry-meta" },
      el("span", { class: `outcome ${h.outcome}` }, h.outcome),
      el("span", {}, formatWhen(h.finishedAt)),
    ),
    el("div", { class: "history-task" }, h.task),
    collapsible("Result", markdownView(h.result, "more-body")),
  );
}
