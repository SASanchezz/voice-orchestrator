// The center: the assistant's chat, or the selected project's active session with its tabs; the message box below.

import type { ProjectView, SessionView } from "../protocol.js";
import { el, button, byId, autoGrow } from "./dom.js";
import { act } from "./api.js";
import { store, activeSession, isBusy, STATUS_LABELS } from "./store.js";
import type { ChatView } from "./chat.js";

export function renderConversation(chat: ChatView) {
  const project = store.selectedProject();
  const tabs = byId("session-tabs");
  const input = byId<HTMLTextAreaElement>("composer-input");
  tabs.hidden = !project;
  if (!project) {
    input.placeholder = "Message the assistant…";
    return chat.showOrchestrator();
  }
  const session = activeSession(project);
  input.placeholder = `Task for ${project.name} · session ${session.number}…`;
  const newSession = button("+", "ghost session-new", () => void createSession(project));
  newSession.title = `New session in ${project.name}`;
  tabs.replaceChildren(...sessionTabs(project), newSession);
  void chat.showSession(session.id);
}

function sessionTabs(project: ProjectView): HTMLDivElement[] {
  return project.sessions.map((session) => {
    const active = session.id === project.activeSession;
    const open = el("button", { type: "button", class: "session-open", title: sessionTitle(session) },
      el("span", { class: `dot ${session.status}`, title: STATUS_LABELS[session.status] }),
      el("span", { class: "session-name" }, `Session ${session.number}`),
      el("span", { class: "session-title" }, sessionTitle(session)));
    open.addEventListener("click", () => {
      if (!active) void act(`/api/sessions/${session.id}/activate`);
    });
    const close = button("×", "ghost session-close", () => closeSession(session));
    close.title = `Close session ${session.number}`;
    close.setAttribute("aria-label", `Close session ${session.number}`);
    return el("div", { class: `session-tab${active ? " active" : ""}`, role: "tab", "aria-selected": String(active) }, open, close);
  });
}

/** Like a VS Code tab: named after what the session is about. */
function sessionTitle(session: SessionView): string {
  return session.task ?? session.history[0]?.task ?? "new";
}

function createSession(project: ProjectView) {
  return act(`/api/projects/${encodeURIComponent(project.name)}/sessions`);
}

function closeSession(session: SessionView) {
  const warning = `Close session ${session.number}?${isBusy(session) ? " Its worker will be stopped." : ""} Its messages, queue and history are deleted.`;
  if (confirm(warning)) void act(`/api/sessions/${session.id}/close`);
}

export function wireComposer() {
  const form = byId<HTMLFormElement>("composer");
  const input = byId<HTMLTextAreaElement>("composer-input");
  form.addEventListener("submit", (event) => sendMessage(event, input));
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    form.requestSubmit();
  });
}

function sendMessage(event: SubmitEvent, input: HTMLTextAreaElement) {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  autoGrow(input);
  const project = store.selectedProject();
  if (project) void act(`/api/sessions/${project.activeSession}/tasks`, { instruction: text });
  else void act("/api/message", { text });
}
