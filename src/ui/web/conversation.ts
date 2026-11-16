// The chat: the assistant's, or the selected project's active session with its tabs; the message box below.
// With a project selected and VS Code available, it is the panel on VS Code's right (code-view.ts).

import type { ProjectView } from "../protocol.js";
import { act } from "./api.js";
import { wireAttachmentInput } from "./attachment-input.js";
import { type AttachmentTray, encodeForSending } from "./attachments.js";
import type { ChatView } from "./chat.js";
import { renderComposerModel, resetComposerModel } from "./composer-model.js";
import { type MessageRoute, spokenRoute, typedRoute } from "./message-routes.js";
import { autoGrow, button, byId } from "./dom.js";
import { markProject } from "./project-links.js";
import { openTodoCountOf } from "./project-todo.js";
import { sessionPicker } from "./session-picker.js";
import { currentSessionTab, todoTab } from "./session-tabs.js";
import { activeSession, store } from "./store.js";
import { projectNote } from "./project-note.js";

export function renderConversation(chat: ChatView): void {
  const project = store.selectedProject();
  const tabs = byId("session-tabs", HTMLElement);
  const input = byId("composer-input", HTMLTextAreaElement);
  tabs.hidden = !project;
  markProject(byId("feed", HTMLOListElement), project?.name);
  renderComposerModel(project);
  if (!project) {
    input.placeholder = "Message the assistant…";
    return chat.showOrchestrator();
  }
  const session = activeSession(project);
  input.placeholder = `Task for ${project.name} · session ${session.number}…`;
  const todo = todoTab(project, openTodoCountOf(project.name));
  const current = currentSessionTab(project, session);
  tabs.replaceChildren(todo, current, newSessionButton(project), ...sessionPicker(project), ...projectNote(project));
  void chat.showSession(session.id);
}

function newSessionButton(project: ProjectView): HTMLButtonElement {
  const newSession = button("+", "ghost session-new", () => void createSession(project));
  newSession.title = `New session in ${project.name}`;
  return newSession;
}

/** The new session's chat is shown, even from the To-do tab. */
function createSession(project: ProjectView): Promise<string | undefined> {
  store.showProjectChat();
  return act(`/api/projects/${encodeURIComponent(project.name)}/sessions`);
}

export function wireComposer(tray: AttachmentTray): void {
  const form = byId("composer", HTMLFormElement);
  const input = byId("composer-input", HTMLTextAreaElement);
  wireAttachmentInput(tray);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendMessage(input, tray, typedRoute());
  });
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    form.requestSubmit();
  });
}

/** What the box holds, with your spoken words in it, goes where you were when you started talking. */
export function sendSpokenMessage(tray: AttachmentTray, session: string | undefined): void {
  void sendMessage(byId("composer-input", HTMLTextAreaElement), tray, spokenRoute(session));
}

/** What the box holds and the files attached go along `route`; kept if sending fails. */
async function sendMessage(input: HTMLTextAreaElement, tray: AttachmentTray, route: MessageRoute): Promise<void> {
  const text = input.value.trim();
  const files = tray.attached;
  if (!text && !files.length) return;
  input.value = "";
  autoGrow(input);
  tray.clear();
  if ((await send(route, text, files)) !== undefined) return resetComposerModel();
  input.value = text;
  autoGrow(input);
  tray.add(files);
}

async function send(route: MessageRoute, text: string, files: File[]): Promise<string | undefined> {
  const attachments = await encodeForSending(files);
  if (!attachments) return undefined;
  return act(route.path, route.body(text, attachments));
}
