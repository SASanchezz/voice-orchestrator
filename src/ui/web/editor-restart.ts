// The header's Restart VS Code button: a new VS Code server for the Code view, for when the running one can no longer
// start its extensions (Markdown preview and the like stop working). Its terminals stop, so you confirm first.

import { act } from "./api.js";
import { byId, confirmInDialog } from "./dom.js";
import { store } from "./store.js";

const RESTART_LABEL = "Restart VS Code";
const RESTARTING_LABEL = "Restarting VS Code…";

export function wireEditorRestart(): void {
  byId("editor-restart-button", HTMLButtonElement).addEventListener("click", askToRestartEditor);
}

/** Shown only with a Code view; busy while VS Code restarts, which the editor's status says on every open page. */
export function renderEditorRestart(): void {
  const button = byId("editor-restart-button", HTMLButtonElement);
  const isRestarting = store.state.editor === "restarting";
  button.hidden = store.state.editor === "off";
  button.disabled = isRestarting;
  button.textContent = isRestarting ? RESTARTING_LABEL : RESTART_LABEL;
}

function askToRestartEditor(): void {
  confirmInDialog(byId("editor-restart-dialog", HTMLDialogElement), () => void act("/api/editor/restart"));
}
