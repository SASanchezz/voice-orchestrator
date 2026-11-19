import type { RestartableEditor } from "../../editor/editor.js";
import { errorMessage } from "../../shared/errors.js";
import type { Route } from "./route-table.js";

const RESTARTING = "Restarting VS Code.";

/** The header's Restart VS Code button. */
export function editorRoutes(editor: RestartableEditor): [RegExp, Route][] {
  return [[/^\/api\/editor\/restart$/, () => restartInBackground(editor)]];
}

/** Answers at once: the page follows the restart through the editor's status. */
function restartInBackground(editor: RestartableEditor): string {
  editor.restart().catch((error: unknown) => console.error(`[editor] Restart failed: ${errorMessage(error)}`));
  return RESTARTING;
}
