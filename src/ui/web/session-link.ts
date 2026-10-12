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

/** Selects the project and makes the session its active one; a session closed since is skipped. */
async function openSession({ project, id }: SessionLinkView): Promise<void> {
  const view = store.state.projects.find((p) => p.name === project);
  const isOpen = view?.sessions.some((s) => s.id === id);
  if (isOpen && view?.activeSession !== id) await act(`/api/sessions/${id}/activate`);
  store.select(project);
}
