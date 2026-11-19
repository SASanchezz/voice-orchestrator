// A message box you can speak into, whatever starts the recording: its mic button, the talk key, the wake word or a
// talk gesture. Your words appear after what the box held as you speak. ■, Enter or starting to edit stops the
// recording and leaves them there to edit and send; Send while recording stops it and sends the final words. ✕ or Esc
// during a recording cancels it: its words go, and the box keeps what it held before. The composer and the notice
// panel's reply use it.

import { act } from "./api.js";
import { BoxText } from "./box-text.js";
import { PAGE_ID } from "./page-id.js";
import { wireStopOnEdit } from "./stop-on-edit.js";

type MicState = "idle" | "recording" | "transcribing";

const LABELS: Record<MicState, string> = { idle: "🎙", recording: "■", transcribing: "…" };
const TITLES: Record<MicState, string> = {
  idle: "Speak your message; your words appear in the box as you talk",
  recording: "Recording; click, press Enter or start typing to stop and edit, or Send to stop and send",
  transcribing: "Finishing your words…",
};

/** The box, its mic and ✕ buttons, the button that sends what it holds, and where it says your words go. */
export interface DictationParts {
  input: HTMLTextAreaElement;
  mic: HTMLButtonElement;
  cancel: HTMLButtonElement;
  send: HTMLButtonElement;
  target?: HTMLElement;
  /** Sends the final words after Send during a recording; submitting the form when not given. */
  sendFinished?: () => void;
}

export class DictationBox {
  private state: MicState = "idle";
  private text: BoxText;

  constructor(private parts: DictationParts) {
    this.text = new BoxText(parts.input);
  }

  /** Esc cancels a recording before anything else on the page sees it; Enter in `form` stops it instead of sending. */
  wire(form: HTMLFormElement): void {
    this.parts.mic.addEventListener("click", () => void this.toggle());
    this.parts.cancel.addEventListener("click", () => void this.discard());
    wireRecordingKeys(this, form);
    wireSendWhileRecording(this, this.parts, form);
    wireStopOnEdit(this, this.parts.input);
    this.show("idle");
  }

  isIdle(): boolean {
    return this.state === "idle";
  }

  isRecording(): boolean {
    return this.state === "recording";
  }

  /** The server started a recording for this box, by its mic button or any other way; `destination` is where it goes. */
  follow(destination: string): void {
    this.text.holdTyped();
    if (this.parts.target) this.parts.target.textContent = destination;
    this.show("recording");
  }

  showWords(words: string): void {
    if (this.isRecording()) this.text.showWords(words);
  }

  /** The recording ended elsewhere: your final words stay after what the box held, "" for none. */
  endWith(words: string): void {
    this.text.showWords(words);
    this.show("idle");
  }

  /** Nothing heard leaves the box as it was. False when the server couldn't finish, so nothing should be sent. */
  async finish(): Promise<boolean> {
    this.show("transcribing");
    const words = await act("/api/dictation/finish");
    this.endWith(words ?? "");
    this.parts.input.focus();
    return words !== undefined;
  }

  /** Cancelling a recording drops only its words: the box keeps what it held before. */
  async discard(): Promise<void> {
    this.endWith("");
    await act("/api/dictation/cancel");
  }

  /** The mic button: start a recording into this box, or stop the one going to edit it. */
  async toggle(): Promise<void> {
    if (this.state === "idle") await act("/api/dictation/start", { page: PAGE_ID });
    else if (this.isRecording()) await this.finish();
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

/** Send while recording stops it and sends the final words, not the ones half-heard; a failed finish sends nothing. */
function wireSendWhileRecording(box: DictationBox, parts: DictationParts, form: HTMLFormElement): void {
  const sendFinished = parts.sendFinished ?? (() => form.requestSubmit());
  parts.send.addEventListener("click", (click) => {
    if (box.isIdle()) return;
    click.preventDefault();
    if (box.isRecording()) void finishThenSend(box, sendFinished);
  });
}

async function finishThenSend(box: DictationBox, sendFinished: () => void): Promise<void> {
  const isFinished = await box.finish();
  if (isFinished) sendFinished();
}

/** Enter stops recording instead of sending the words half-heard; it is caught before the box's own Enter. */
function stopOnEnter(box: DictationBox, e: KeyboardEvent): void {
  if (e.key !== "Enter" || box.isIdle()) return;
  e.preventDefault();
  e.stopPropagation();
  if (box.isRecording()) void box.finish();
}

function showMicState({ input, mic, cancel, send, target }: DictationParts, state: MicState): void {
  if (target) target.hidden = state !== "recording" || !target.textContent;
  mic.textContent = LABELS[state];
  mic.title = TITLES[state];
  mic.className = `ghost mic-button ${state}`;
  mic.disabled = state === "transcribing";
  cancel.hidden = state !== "recording";
  input.readOnly = state !== "idle"; // the words being heard would overwrite what you type
  send.disabled = state === "transcribing";
}
