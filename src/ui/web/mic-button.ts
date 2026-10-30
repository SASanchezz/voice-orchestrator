// The composer's mic button: click to record on this Mac. Your words appear in the message box as you speak, after
// what it already held; click again or press Enter to stop, and they stay there to edit and send. ✕ or Esc discards
// the recording and puts back what the box held before.

import { act } from "./api.js";
import { autoGrow, byId } from "./dom.js";
import { store } from "./store.js";

type MicState = "idle" | "recording" | "transcribing";

const LABELS: Record<MicState, string> = { idle: "🎙", recording: "■", transcribing: "…" };
const TITLES: Record<MicState, string> = {
  idle: "Speak your message; your words appear in the box as you talk",
  recording: "Recording; click or press Enter to stop, then edit and send",
  transcribing: "Finishing your words…",
};

let state: MicState = "idle";
/** What the message box held when recording started; your words go after it. */
let typedBefore = "";

export function wireMicButton(): void {
  byId("mic-button", HTMLButtonElement).addEventListener("click", () => void toggle());
  byId("mic-cancel", HTMLButtonElement).addEventListener("click", () => void discard());
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || state !== "recording") return;
    e.preventDefault(); // before the voice message's own Esc
    void discard();
  });
  byId("composer", HTMLFormElement).addEventListener("keydown", stopOnEnter, { capture: true });
  show("idle");
}

/** Text mode has no mic, so no button. */
export function renderMicButton(): void {
  byId("mic-button", HTMLButtonElement).hidden = store.state.gestures === "unavailable";
}

/** Your words so far, from the server while this page records; another page's recording isn't shown here. */
export function showDictatedWords(words: string): void {
  if (state !== "recording") return;
  writeWords(words);
}

/** Enter stops recording instead of sending the words half-heard; it is caught before the box's own Enter. */
function stopOnEnter(e: KeyboardEvent): void {
  if (e.key !== "Enter" || state === "idle") return;
  e.preventDefault();
  e.stopPropagation();
  if (state === "recording") void finish();
}

async function toggle(): Promise<void> {
  if (state === "idle") return start();
  if (state === "recording") return finish();
}

async function start(): Promise<void> {
  typedBefore = composerInput().value;
  if ((await act("/api/dictation/start")) !== undefined) show("recording");
}

/** Nothing heard leaves the box as it was. */
async function finish(): Promise<void> {
  show("transcribing");
  const words = await act("/api/dictation/finish");
  writeWords(words ?? "");
  show("idle");
  composerInput().focus();
}

async function discard(): Promise<void> {
  writeWords("");
  show("idle");
  await act("/api/dictation/cancel");
}

function writeWords(words: string): void {
  const input = composerInput();
  input.value = afterTyped(words);
  autoGrow(input);
  input.scrollTop = input.scrollHeight;
}

function afterTyped(words: string): string {
  const needsSpace = words !== "" && typedBefore !== "" && !/\s$/.test(typedBefore);
  return needsSpace ? `${typedBefore} ${words}` : typedBefore + words;
}

function show(next: MicState): void {
  state = next;
  const mic = byId("mic-button", HTMLButtonElement);
  mic.textContent = LABELS[next];
  mic.title = TITLES[next];
  mic.className = `ghost mic-button ${next}`;
  mic.disabled = next === "transcribing";
  byId("mic-cancel", HTMLButtonElement).hidden = next !== "recording";
  composerInput().readOnly = next !== "idle"; // the words being heard would overwrite what you type
  byId("composer-send", HTMLButtonElement).disabled = next !== "idle";
}

function composerInput(): HTMLTextAreaElement {
  return byId("composer-input", HTMLTextAreaElement);
}
