// Small status displays: the connection dot, the mode switches, the listening strip, the tab title and corner notices.

import type { FeedEntryView, VoiceInputName } from "../protocol.js";
import { el, byId } from "./dom.js";
import { act } from "./api.js";
import { store } from "./store.js";

const BASE_TITLE = "Orchestrator";
const NOTICE_MS = 4000;
const VOICE_INPUT_NOTICE: Record<VoiceInputName, string> = {
  idle: "",
  recording: "Listening…",
  held: "Holding your message a moment in case you keep talking…",
};

export function renderIndicators() {
  const { permissionMode, speechMode, voiceInput, pending } = store.state;
  markSegment("permission-mode", permissionMode);
  markSegment("speech-mode", speechMode);
  const notice = byId("voice-status");
  notice.hidden = voiceInput === "idle";
  notice.textContent = VOICE_INPUT_NOTICE[voiceInput];
  document.title = pending.length ? `(${pending.length}) ${BASE_TITLE}` : BASE_TITLE;
}

function markSegment(id: string, value: string) {
  for (const option of byId(id).querySelectorAll<HTMLButtonElement>("button"))
    option.setAttribute("aria-checked", String(option.dataset.value === value));
}

/** A mode switch: clicking an option sends it to the server. */
export function wireSegment(id: string, path: string) {
  byId(id).addEventListener("click", (e) => {
    const value = (e.target as Element).closest("button")?.dataset.value;
    if (value) void act(path, { mode: value });
  });
}

export function setConnected(live: boolean) {
  const dot = byId("connection");
  dot.classList.toggle("live", live);
  dot.title = live ? "Connected" : "Disconnected, retrying…";
}

/** A brief corner notice, matching what's said aloud when a task ends. */
export function flashTaskOutcome(entry: FeedEntryView) {
  if (!entry.taskOutcome) return;
  const notice = el("div", { class: `notice ${entry.taskOutcome}`, role: "status" }, `${entry.about} ${entry.taskOutcome}`);
  document.body.append(notice);
  setTimeout(() => notice.remove(), NOTICE_MS);
}
