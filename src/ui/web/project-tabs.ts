// The tabs along the top: the assistant's chat, then one per project, busiest and most recently active first.

import { byRecentActivity } from "../project-recency.js";
import type { ProjectView, SessionStatus, SessionView } from "../protocol.js";
import { act } from "./api.js";
import { byId, el } from "./dom.js";
import { isUnseen } from "./seen-results.js";
import { store, activeSession, STATUS_LABELS } from "./store.js";

// a project's dot shows its most pressing session
const STATUS_URGENCY: SessionStatus[] = ["waiting_permission", "running", "failed", "done", "stopped", "idle"];

export function renderProjectTabs(): void {
  const { projects } = store.state;
  const tabs = projects.length
    ? byRecentActivity(projects).map(projectTab)
    : [el("span", { class: "empty" }, "No projects yet. Ask the assistant to open one.")];
  byId("project-tabs", HTMLElement).replaceChildren(assistantTab(), ...tabs);
  renderAssistantClear();
}

/** The main chat with the orchestrator. Always there: it can be cleared, never closed. */
function assistantTab(): HTMLButtonElement {
  const selected = store.selectedProject() ? "" : " selected";
  const tab = el("button", { type: "button", class: `project-tab assistant-tab${selected}` }, "Assistant");
  tab.addEventListener("click", () => {
    store.hideReview();
    store.select("");
  });
  return tab;
}

export function wireAssistantClear(): void {
  byId("assistant-clear", HTMLButtonElement).addEventListener("click", () => void clearAssistant());
}

function renderAssistantClear(): void {
  const clear = byId("assistant-clear", HTMLButtonElement);
  clear.textContent = store.clearingAssistant ? "Saving…" : "Clear assistant chat";
  clear.disabled = store.clearingAssistant;
}

async function clearAssistant(): Promise<void> {
  if (
    !confirm(
      "Clear the assistant's chat? It first saves a short summary and key facts, then deletes the messages. Projects and their sessions are kept.",
    )
  )
    return;
  store.setClearingAssistant(true);
  await act("/api/assistant/clear");
  store.setClearingAssistant(false);
}

function projectTab(project: ProjectView): HTMLButtonElement {
  const status = projectStatus(project);
  const selected = project.name === store.selectedProjectName ? " selected" : "";
  const tab = el(
    "button",
    { type: "button", class: `project-tab${selected}`, title: tabTitle(project) },
    el("span", { class: `dot ${status}`, title: STATUS_LABELS[status] }),
    el("span", { class: "project-tab-name" }, project.name),
    ...unseenBadge(project),
    ...changesBadge(project),
  );
  tab.addEventListener("click", () => store.select(project.name));
  return tab;
}

/** What the tab has no room for. */
function tabTitle(project: ProjectView): string {
  const sessions = `${project.sessions.length} session${project.sessions.length === 1 ? "" : "s"}`;
  const now = sessionSubtitle(activeSession(project));
  return `${project.folderFromHome}\n${project.profile} account · ${sessions}\n${now}`;
}

/** "2 new": sessions with finished work you haven't seen. */
function unseenBadge(project: ProjectView): HTMLSpanElement[] {
  const count = project.sessions.filter(isUnseen).length;
  if (!count) return [];
  const badge = el("span", { class: "badge unseen-badge" }, `${count} new`);
  badge.title = "Sessions with finished work you haven't looked at yet";
  return [badge];
}

/** How many files have uncommitted changes. */
function changesBadge(project: ProjectView): HTMLSpanElement[] {
  const count = store.changes.find((view) => view.project === project.name)?.files.length;
  if (!count) return [];
  const badge = el("span", { class: "badge changes-badge" }, `±${count}`);
  badge.title = `${count} changed file${count === 1 ? "" : "s"}; Review shows them`;
  return [badge];
}

function projectStatus(project: ProjectView): SessionStatus {
  return STATUS_URGENCY.find((status) => project.sessions.some((s) => s.status === status)) ?? "idle";
}

function sessionSubtitle(session: SessionView): string {
  if (session.status === "running" && session.lastActivity) return `now: ${session.lastActivity}`;
  const queued = session.queued.length ? ` · ${session.queued.length} queued` : "";
  return `${STATUS_LABELS[session.status]}${queued}`;
}
