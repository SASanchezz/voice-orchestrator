// A busy session's ■, on the session tab and in the session list; only that session's own queue is cleared.

import type { SessionView } from "../protocol.js";
import { isBusy } from "../running-tasks.js";
import { act } from "./api.js";
import { button } from "./dom.js";

export function stopButtons(session: SessionView): HTMLButtonElement[] {
  if (!isBusy(session)) return [];
  const stop = button("■", "ghost session-stop", () => void act(`/api/sessions/${session.id}/stop`));
  stop.title = `Stop session ${session.number}; its queue is cleared, other sessions keep running`;
  stop.setAttribute("aria-label", `Stop session ${session.number}`);
  return [stop];
}
