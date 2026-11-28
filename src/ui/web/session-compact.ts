// A session's "Compact context" menu item: Claude Code's /compact on its conversation, which then goes on from a
// summary of itself. Only an idle session that has talked can be compacted.

import type { ProjectView, SessionView } from "../protocol.js";
import { isBusy } from "../running-tasks.js";
import { act } from "./api.js";
import { button } from "./dom.js";
import { showProjectNote } from "./project-note.js";

const READY_TITLE = "Shrink this session's context: its older turns become a summary and the session goes on from it.";
const BUSY_TITLE = "The session is working; compact it once it is idle.";
const EMPTY_TITLE = "The session has no conversation to compact yet.";

export function compactMenuItem(project: ProjectView, session: SessionView, onPick: () => void): HTMLButtonElement {
  const item = button("Compact context", "ghost session-menu-item", () => {
    onPick();
    void compact(project, session);
  });
  item.setAttribute("role", "menuitem");
  item.title = compactTitle(session);
  item.disabled = item.title !== READY_TITLE;
  return item;
}

function compactTitle(session: SessionView): string {
  if (isBusy(session)) return BUSY_TITLE;
  return session.contextTokens === undefined ? EMPTY_TITLE : READY_TITLE;
}

async function compact(project: ProjectView, session: SessionView): Promise<void> {
  const report = await act(`/api/sessions/${session.id}/compact`);
  if (report !== undefined) showProjectNote(project.name, report);
}
