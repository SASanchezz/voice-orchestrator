// The center: the assistant's chat, or the selected project's active session with its tabs; the message box below.
// A project shown as code has VS Code there instead (code-view.ts).

import type { ProjectView } from "../protocol.js";
import { act } from "./api.js";
import { wireAttachmentInput } from "./attachment-input.js";
import { type AttachmentTray, encodeForSending } from "./attachments.js";
import type { ChatView } from "./chat.js";
import { viewToggle } from "./code-view.js";
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
  tabs.replaceChildren(...viewToggle(project), ...sessionTabs(project), newSession);
  void chat.showSession(session.id);
}

function createSession(project: ProjectView): Promise<string | undefined> {
  return act(`/api/projects/${encodeURIComponent(project.name)}/sessions`);
}

export function wireComposer(tray: AttachmentTray): void {
  const form = byId("composer", HTMLFormElement);
  const input = byId("composer-input", HTMLTextAreaElement);
  wireAttachmentInput(tray);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendMessage(input, tray);
  });
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    form.requestSubmit();
  });
}

/** What you typed and attached goes to the selected project's session, or else to the assistant; kept if sending fails. */
async function sendMessage(input: HTMLTextAreaElement, tray: AttachmentTray): Promise<void> {
  const text = input.value.trim();
  const files = tray.attached;
  if (!text && !files.length) return;
  input.value = "";
  autoGrow(input);
  tray.clear();
  if ((await send(text, files)) !== undefined) return;
  input.value = text;
  autoGrow(input);
  tray.add(files);
}

async function send(text: string, files: File[]): Promise<string | undefined> {
  const attachments = await encodeForSending(files);
  if (!attachments) return undefined;
  const project = store.selectedProject();
  if (project) return act(`/api/sessions/${project.activeSession}/tasks`, { instruction: text, attachments });
  return act("/api/message", { text, attachments });
}
