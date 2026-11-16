// Showing a session's chat from its tab or from the session list.

import type { ProjectView, SessionView } from "../protocol.js";
import { act } from "./api.js";
import { store } from "./store.js";

/** Leaves the To-do tab, and makes the session its project's active one unless it already is. */
export function showSessionChat(project: ProjectView, session: SessionView): void {
  store.showProjectChat();
  if (session.id !== project.activeSession) void act(`/api/sessions/${session.id}/activate`);
}
