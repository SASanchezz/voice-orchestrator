// The Code view: VS Code on the selected project's folder, in place of its chat. Each project's frame is made once and
// kept, because the page re-renders on every state push and a new frame would reload VS Code and lose its open tabs.

import { editorUrl } from "../../editor/editor-url.js";
import { PROJECT_VIEWS, type ProjectViewName } from "../page-target.js";
import type { EditorStateName, ProjectView } from "../protocol.js";
import { token } from "./api.js";
import { button, byId, bySelector, el } from "./dom.js";
import { store } from "./store.js";

const VIEW_LABELS: Record<ProjectViewName, string> = { chat: "Chat", code: "Code" };
const EDITOR_NOTICES: Record<EditorStateName, string> = {
  off: "",
  starting: "Starting VS Code… (its first run downloads it)",
  ready: "",
  failed: "VS Code stopped. Starting it again…",
};

/** Each project's VS Code frame, by project name. */
const frames = new Map<string, HTMLIFrameElement>();

export function renderCodeView(): void {
  const project = store.selectedProject();
  const shown = project && isCodeShown(project) ? project : undefined;
  bySelector("main.layout", HTMLElement).classList.toggle("code-mode", shown !== undefined);
  dropRemovedProjects();
  renderNotice(shown);
  showFrame(shown);
}

/** "Chat | Code" before the session tabs; there is no Code view while the editor is off. */
export function viewToggle(project: ProjectView): HTMLElement[] {
  if (store.state.editor === "off") return [];
  const options = PROJECT_VIEWS.map((view) => viewOption(project, view));
  return [el("div", { class: "segmented view-toggle", role: "radiogroup", "aria-label": "Chat or code" }, ...options)];
}

function viewOption(project: ProjectView, view: ProjectViewName): HTMLButtonElement {
  const option = button(VIEW_LABELS[view], "view-option", () => store.showView(project.name, view));
  option.setAttribute("role", "radio");
  option.setAttribute("aria-checked", String(store.viewOf(project.name) === view));
  return option;
}

function isCodeShown(project: ProjectView): boolean {
  return store.state.editor !== "off" && store.viewOf(project.name) === "code";
}

function dropRemovedProjects(): void {
  const names = new Set(store.state.projects.map((p) => p.name));
  for (const [name, frame] of frames) {
    if (names.has(name)) continue;
    frame.remove();
    frames.delete(name);
  }
}

function renderNotice(project: ProjectView | undefined): void {
  const notice = byId("code-status", HTMLElement);
  const message = project ? EDITOR_NOTICES[store.state.editor] : "";
  notice.hidden = !message;
  notice.textContent = message;
}

/** Only the shown project's frame is visible; while VS Code restarts, its frames wait hidden and reconnect after. */
function showFrame(project: ProjectView | undefined): void {
  const isReady = store.state.editor === "ready";
  if (project && isReady && !frames.has(project.name)) addFrame(project);
  const shown = isReady ? project?.name : undefined;
  for (const [name, frame] of frames) frame.hidden = name !== shown;
}

function addFrame(project: ProjectView): void {
  const frame = el("iframe", {
    class: "code-frame",
    src: editorUrl(project.folder, token),
    title: `VS Code on ${project.name}`,
  });
  frames.set(project.name, frame);
  byId("code-frames", HTMLElement).append(frame);
}
