// The Code view: VS Code on the selected project's folder, with the project's chat in a panel on its right. Each
// project's frame is made once and kept, because the page re-renders on every state push and a new frame would reload
// VS Code and lose its open tabs.

import { editorUrl } from "../../editor/editor-url.js";
import type { EditorStateName, ProjectView } from "../protocol.js";
import { token } from "./api.js";
import { byId, bySelector, el } from "./dom.js";
import { store } from "./store.js";

const EDITOR_NOTICES: Record<EditorStateName, string> = {
  off: "",
  starting: "Starting VS Code… (its first run downloads it)",
  ready: "",
  failed: "VS Code stopped. Starting it again…",
};

/** Each project's VS Code frame, by project name. */
const frames = new Map<string, HTMLIFrameElement>();

/** A selected project gets VS Code next to its chat, unless the editor is off; then its chat fills the middle. */
export function renderCodeView(): void {
  const project = store.selectedProject();
  const shown = project && store.state.editor !== "off" ? project : undefined;
  const layout = bySelector("main.layout", HTMLElement);
  layout.classList.toggle("project-mode", project !== undefined);
  layout.classList.toggle("ide-mode", shown !== undefined);
  dropRemovedProjects();
  renderNotice(shown);
  showFrame(shown);
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
