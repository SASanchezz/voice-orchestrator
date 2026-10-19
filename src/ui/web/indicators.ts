// Small status displays: the connection dot, the mode switches, the listening strip and the tab title.

import type { VoiceInputName } from "../protocol.js";
import { act } from "./api.js";
import { byId } from "./dom.js";
import { store } from "./store.js";

const BASE_TITLE = "Orchestrator";
const VOICE_INPUT_NOTICE: Record<VoiceInputName, string> = {
  idle: "",
  recording: "Listening…",
  held: "Holding your message a moment in case you keep talking…",
  queued: "Your message waits for the assistant to finish its current reply…",
};

export function renderIndicators(): void {
  const { permissionMode, speechMode, voiceInput, pending } = store.state;
  markSegment("permission-mode", permissionMode);
  markSegment("speech-mode", speechMode);
  byId("voice-status", HTMLElement).hidden = voiceInput === "idle";
  byId("voice-status-text", HTMLElement).textContent = VOICE_INPUT_NOTICE[voiceInput];
  document.title = pending.length ? `(${pending.length}) ${BASE_TITLE}` : BASE_TITLE;
}

function markSegment(id: string, value: string): void {
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
