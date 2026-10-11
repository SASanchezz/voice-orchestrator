// The center: the assistant's chat, or the selected project's active session with its tabs; the message box below.

import type { ProjectView } from "../protocol.js";
import { act } from "./api.js";
import type { ChatView } from "./chat.js";
import { autoGrow, button, byId } from "./dom.js";
import { sessionTabs } from "./session-tabs.js";
import { activeSession, store } from "./store.js";

export function renderConversation(chat: ChatView): void {
  const project = store.selectedProject();
  const tabs = byId("session-tabs", HTMLElement);
  const input = byId("composer-input", HTMLTextAreaElement);
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

function createSession(project: ProjectView): Promise<string | undefined> {
  return act(`/api/projects/${encodeURIComponent(project.name)}/sessions`);
}

export function wireComposer(): void {
  const form = byId("composer", HTMLFormElement);
  const input = byId("composer-input", HTMLTextAreaElement);
  form.addEventListener("submit", (event) => sendMessage(event, input));
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    form.requestSubmit();
  });
}

function sendMessage(event: SubmitEvent, input: HTMLTextAreaElement): void {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  autoGrow(input);
  const project = store.selectedProject();
  if (project) void act(`/api/sessions/${project.activeSession}/tasks`, { instruction: text });
  else void act("/api/message", { text });
}
