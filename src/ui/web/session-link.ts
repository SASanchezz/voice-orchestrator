// "Open prewins session 22" under an assistant's line that relays a worker's answer: shows that session's chat.

import type { SessionLinkView } from "../protocol.js";
import { act } from "./api.js";
import { button } from "./dom.js";
import { store } from "./store.js";

export function sessionLink(session: SessionLinkView): HTMLButtonElement {
  const link = button(`Open ${session.project} session ${session.number}`, "link session-link", () => {
    void openSession(session);
  });
  link.title = "Show this session's full answer";
  return link;
}

/** Opens a session known only by its id; a session closed since is skipped. */
export async function openSessionById(id: string): Promise<void> {
  const project = store.state.projects.find((p) => p.sessions.some((s) => s.id === id));
  if (project) await openSession({ project: project.name, id });
}

/** Selects the project and shows the session's chat as its active one; a session closed since is skipped. */
async function openSession({ project, id }: Pick<SessionLinkView, "project" | "id">): Promise<void> {
  const view = store.state.projects.find((p) => p.name === project);
  const isOpen = view?.sessions.some((s) => s.id === id);
  if (isOpen && view?.activeSession !== id) await act(`/api/sessions/${id}/activate`);
  store.select(project);
  store.showView(project, "chat");
}
