// A message box you can speak into: its mic button records on this Mac, and your words appear in the box as you speak,
// after what it already held; click again or press Enter to stop, and they stay there to edit and send. ✕ or Esc
// discards the recording and puts back what the box held before. The composer and the notice panel's reply use it.

import { act } from "./api.js";
import { autoGrow } from "./dom.js";

type MicState = "idle" | "recording" | "transcribing";

const LABELS: Record<MicState, string> = { idle: "🎙", recording: "■", transcribing: "…" };
const TITLES: Record<MicState, string> = {
  idle: "Speak your message; your words appear in the box as you talk",
  recording: "Recording; click or press Enter to stop, then edit and send",
  transcribing: "Finishing your words…",
};

/** The box, its mic and ✕ buttons, and the button that sends what it holds. */
export interface DictationParts {
  input: HTMLTextAreaElement;
  mic: HTMLButtonElement;
  cancel: HTMLButtonElement;
  send: HTMLButtonElement;
}

export class DictationBox {
  private state: MicState = "idle";
  /** What the box held when recording started; your words go after it. */
  private typedBefore = "";

  constructor(private parts: DictationParts) {}

  /** Esc discards a recording before anything else on the page sees it; Enter in `form` stops it instead of sending. */
  wire(form: HTMLFormElement): void {
    this.parts.mic.addEventListener("click", () => void this.toggle());
    this.parts.cancel.addEventListener("click", () => void this.discard());
    wireRecordingKeys(this, form);
    this.show("idle");
  }

  isIdle(): boolean {
    return this.state === "idle";
  }

  isRecording(): boolean {
    return this.state === "recording";
  }

  /** Your words so far, from the server while this page records; another page's recording isn't shown here. */
  showWords(words: string): void {
    if (this.isRecording()) writeAfter(this.parts.input, this.typedBefore, words);
  }

  async toggle(): Promise<void> {
    if (this.state === "idle") return this.start();
    if (this.isRecording()) return this.finish();
  }

  /** Nothing heard leaves the box as it was. */
  async finish(): Promise<void> {
    this.show("transcribing");
    const words = await act("/api/dictation/finish");
    writeAfter(this.parts.input, this.typedBefore, words ?? "");
    this.show("idle");
    this.parts.input.focus();
  }

  async discard(): Promise<void> {
    writeAfter(this.parts.input, this.typedBefore, "");
    this.show("idle");
    await act("/api/dictation/cancel");
  }

  private async start(): Promise<void> {
    this.typedBefore = this.parts.input.value;
    if ((await act("/api/dictation/start")) !== undefined) this.show("recording");
  }

  private show(next: MicState): void {
    this.state = next;
    showMicState(this.parts, next);
  }
}

function wireRecordingKeys(box: DictationBox, form: HTMLFormElement): void {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !box.isRecording()) return;
    e.preventDefault(); // before the page's own Esc
    void box.discard();
  });
  form.addEventListener("keydown", (e) => stopOnEnter(box, e), { capture: true });
}

/** Enter stops recording instead of sending the words half-heard; it is caught before the box's own Enter. */
function stopOnEnter(box: DictationBox, e: KeyboardEvent): void {
  if (e.key !== "Enter" || box.isIdle()) return;
  e.preventDefault();
  e.stopPropagation();
  if (box.isRecording()) void box.finish();
}

function writeAfter(input: HTMLTextAreaElement, typedBefore: string, words: string): void {
  input.value = afterTyped(typedBefore, words);
  autoGrow(input);
  input.scrollTop = input.scrollHeight;
}

function afterTyped(typedBefore: string, words: string): string {
  const needsSpace = words !== "" && typedBefore !== "" && !/\s$/.test(typedBefore);
  return needsSpace ? `${typedBefore} ${words}` : typedBefore + words;
}

function showMicState({ input, mic, cancel, send }: DictationParts, state: MicState): void {
  mic.textContent = LABELS[state];
  mic.title = TITLES[state];
  mic.className = `ghost mic-button ${state}`;
  mic.disabled = state === "transcribing";
  cancel.hidden = state !== "recording";
  input.readOnly = state !== "idle"; // the words being heard would overwrite what you type
  send.disabled = state !== "idle";
}
