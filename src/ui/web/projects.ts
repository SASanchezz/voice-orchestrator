// The left column: the assistant's chat, then one card per project.

import { shortFolder } from "../folder-path.js";
import type { ProjectView, SessionStatus, SessionView } from "../protocol.js";
import { act } from "./api.js";
import { button, byId, el } from "./dom.js";
import { store, activeSession, STATUS_LABELS } from "./store.js";

// a project's dot shows its most pressing session
const STATUS_URGENCY: SessionStatus[] = ["waiting_permission", "running", "failed", "done", "stopped", "idle"];

export function renderProjects(): void {
  const { projects } = store.state;
  const items = projects.length
    ? projects.map((p) => el("li", {}, projectCard(p)))
    : [el("li", { class: "empty" }, "No projects yet. Ask the assistant to open one.")];
  byId("project-list", HTMLElement).replaceChildren(...items);
  byId("assistant-entry", HTMLElement).replaceChildren(assistantCard());
}

/** The main chat with the orchestrator. Always there: it can be cleared, never closed. */
function assistantCard(): HTMLDivElement {
  const open = el(
    "button",
    { type: "button", class: "assistant-open" },
    el("span", { class: "assistant-name" }, "Assistant"),
    el("span", { class: "assistant-meta" }, "Main chat"),
  );
  open.addEventListener("click", () => store.select(""));
  const clear = button(
    store.clearingAssistant ? "Saving…" : "Clear",
    "ghost assistant-clear",
    () => void clearAssistant(),
  );
  clear.title = "Clear the assistant's chat; it first saves a short summary of what mattered";
  clear.disabled = store.clearingAssistant;
  return el("div", { class: `assistant${store.selectedProject() ? "" : " selected"}` }, open, clear);
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

function projectCard(project: ProjectView): HTMLButtonElement {
  const card = el(
    "button",
    { class: `project${project.name === store.selectedProjectName ? " selected" : ""}` },
    projectHead(project),
    el("div", { class: "project-folder", title: project.folder }, shortFolder(project.folderFromHome)),
    el("div", { class: "project-meta" }, sessionSubtitle(activeSession(project))),
  );
  card.addEventListener("click", () => store.select(project.name));
  return card;
}

function projectHead(project: ProjectView): HTMLDivElement {
  const status = projectStatus(project);
  const sessionCount =
    project.sessions.length > 1 ? el("span", { class: "badge" }, `${project.sessions.length} sessions`) : "";
  return el(
    "div",
    { class: "project-head" },
    el("span", { class: `dot ${status}`, title: STATUS_LABELS[status] }),
    el("span", { class: "project-name" }, project.name),
    sessionCount,
    el("span", { class: "badge" }, project.profile),
  );
}

function projectStatus(project: ProjectView): SessionStatus {
  return STATUS_URGENCY.find((status) => project.sessions.some((s) => s.status === status)) ?? "idle";
}

function sessionSubtitle(session: SessionView): string {
  if (session.status === "running" && session.lastActivity) return `now: ${session.lastActivity}`;
  const queued = session.queued.length ? ` · ${session.queued.length} queued` : "";
  return `${STATUS_LABELS[session.status]}${queued}`;
}
