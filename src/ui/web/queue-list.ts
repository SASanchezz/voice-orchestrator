// The active session's queued tasks in the right panel, each with a button that drops just that one.

import type { SessionView } from "../protocol.js";
import { act } from "./api.js";
import { button, el } from "./dom.js";

export function queueLines(session: SessionView): HTMLDivElement[] {
  if (!session.queued.length) return [];
  const items = session.queued.map((instruction, index) => queueItem(session.id, index + 1, instruction));
  return [
    el(
      "div",
      { class: "queue" },
      el("span", { class: "muted" }, "Queued:"),
      el("ol", { class: "queue-list" }, ...items),
    ),
  ];
}

function queueItem(sessionId: string, place: number, instruction: string): HTMLLIElement {
  const path = `/api/sessions/${sessionId}/queue/remove`;
  const remove = button("×", "ghost queue-remove", () => void act(path, { place, instruction }));
  remove.title = "Remove this task from the queue; the running task and the rest keep going";
  return el(
    "li",
    { class: "queue-item" },
    el("span", { class: "queue-text", title: instruction }, instruction),
    remove,
  );
}
