// The chat: the assistant's, or the selected project's active session with its tabs; the message box below.
// With a project selected and VS Code available, it is the panel on VS Code's right (code-view.ts).

import type { ProjectView } from "../protocol.js";
import { act } from "./api.js";
import { wireAttachmentInput } from "./attachment-input.js";
import { withReferenceNote, type ReferencedPath } from "../../attachments/referenced-paths.js";
import { encodeForSending } from "./attachments.js";
import type { ComposerAttachments } from "./composer-attachments.js";
import type { ChatView } from "./chat.js";
import { closedSessionList, reopenButton } from "./closed-session-list.js";
import { renderComposerModel } from "./composer-model.js";
import { type MessageRoute, recordedRoute, spokenRoute, typedRoute } from "./message-routes.js";
import { autoGrow, button, byId } from "./dom.js";
import { SIDE_QUESTION_PREFIX } from "../../workers/side-question-prefix.js";
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
  input.placeholder = `Task for ${project.name} · session ${session.number}… (⌥↩ asks a side question)`;
  const todo = todoTab(project, openTodoCountOf(project.name));
  const current = currentSessionTab(project, session);
  const buttons = [newSessionButton(project), reopenButton(project)];
  const dropdowns = [...sessionPicker(project), ...closedSessionList(project)];
  tabs.replaceChildren(todo, current, ...buttons, ...dropdowns, ...projectNote(project));
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

export function wireComposer(attachments: ComposerAttachments): void {
  const form = byId("composer", HTMLFormElement);
  const input = byId("composer-input", HTMLTextAreaElement);
  wireAttachmentInput(attachments);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendMessage(input, attachments, typedRoute());
  });
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (e.altKey) markAsSideQuestion(input);
    form.requestSubmit();
  });
}

/** ⌥↩ in a session asks its worker by the way, as typing /btw first does; the assistant has no side questions. */
function markAsSideQuestion(input: HTMLTextAreaElement): void {
  const isMarked = input.value.trimStart().toLowerCase().startsWith(SIDE_QUESTION_PREFIX);
  if (store.selectedProject() && !isMarked) input.value = `${SIDE_QUESTION_PREFIX} ${input.value.trimStart()}`;
}

/** What the box holds, with your spoken words in it, goes where you were when you started talking. */
export function sendSpokenMessage(attachments: ComposerAttachments, session: string | undefined): void {
  void sendMessage(byId("composer-input", HTMLTextAreaElement), attachments, spokenRoute(session));
}

/** Send pressed during a recording: the box goes where you were when you started talking, even if you moved since. */
export function sendRecordedMessage(attachments: ComposerAttachments, session: string | undefined): void {
  void sendMessage(byId("composer-input", HTMLTextAreaElement), attachments, recordedRoute(session));
}

/** What the box holds, the files attached and the paths pasted go along `route`; kept if sending fails. */
async function sendMessage(
  input: HTMLTextAreaElement,
  attachments: ComposerAttachments,
  route: MessageRoute,
): Promise<void> {
  const draft = { text: input.value.trim(), files: attachments.files.attached, paths: attachments.paths.all };
  if (!draft.text && !draft.files.length && !draft.paths.length) return;
  showDraft(input, attachments, EMPTY_DRAFT);
  const text = withReferenceNote(draft.text, draft.paths);
  if ((await send(route, text, draft.files)) !== undefined) return;
  showDraft(input, attachments, draft);
}

interface Draft {
  text: string;
  files: File[];
  paths: ReferencedPath[];
}

const EMPTY_DRAFT: Draft = { text: "", files: [], paths: [] };

/** The box and its chips hold `draft`: emptied as a message goes, put back when it couldn't. */
function showDraft(input: HTMLTextAreaElement, { files, paths }: ComposerAttachments, draft: Draft): void {
  input.value = draft.text;
  autoGrow(input);
  files.clear();
  files.add(draft.files);
  paths.clear();
  paths.add(draft.paths);
}

async function send(route: MessageRoute, text: string, files: File[]): Promise<string | undefined> {
  const attachments = await encodeForSending(files);
  if (!attachments) return undefined;
  return act(route.path, route.body(text, attachments));
}
