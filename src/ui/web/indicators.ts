// Small status displays: the connection dot, the mode switches and the tab title.

import { act } from "./api.js";
import { byId } from "./dom.js";
import { store } from "./store.js";

const BASE_TITLE = "Orchestrator";

export function renderIndicators(): void {
  const { permissionMode, speechMode, gestures, wakeWord, pending } = store.state;
  markSegment("permission-mode", permissionMode);
  markSegment("speech-mode", speechMode);
  markSegment("gesture-mode", gestures);
  byId("gestures-control", HTMLElement).hidden = gestures === "unavailable";
  markSegment("wake-word-mode", wakeWord);
  byId("wake-word-control", HTMLElement).hidden = wakeWord === "unavailable";
  document.title = pending.length ? `(${pending.length}) ${BASE_TITLE}` : BASE_TITLE;
}

export function markSegment(id: string, value: string): void {
  for (const option of byId(id, HTMLElement).querySelectorAll<HTMLButtonElement>("button"))
    option.setAttribute("aria-checked", String(option.dataset.value === value));
}

/** A mode switch: clicking an option sends it to the server. */
export function wireSegment(id: string, path: string): void {
  byId(id, HTMLElement).addEventListener("click", (e) => {
    const value = e.target instanceof Element ? e.target.closest("button")?.dataset.value : undefined;
    if (value) void act(path, { mode: value });
  });
}

export function setConnected(live: boolean): void {
  const dot = byId("connection", HTMLElement);
  dot.classList.toggle("live", live);
  dot.title = live ? "Connected" : "Disconnected, retrying…";
}
