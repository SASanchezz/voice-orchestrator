import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import { DictationTake, type DictationTranscriber } from "./dictation-take.js";
import { LiveRecording } from "./live-recording.js";

const NOT_LISTENING = "The mic isn't recording; click it to start.";
const NOTHING_HEARD = "Nothing was heard.";
const NO_MIC = "There is no mic in text mode.";

/** The web UI's mic button: start, then finish with your words, or cancel. Your words so far come as "words". */
export interface DictationControl {
  start(): string;
  /** Your words; throws when nothing was said. */
  finish(): Promise<string>;
  cancel(): Promise<string>;
  on(event: "words", listener: (words: string) => void): this;
}

/**
 * Records from the Mac's mic with sox while the mic button is on, and turns it into text with whisper.cpp, the same
 * way the hotkey does, while you speak and once more at the end. Its words go into the page's message box.
 */
export class Dictation extends EventEmitter implements DictationControl {
  private current?: DictationTake;
  private count = 0;

  constructor(
    private recordBin: string,
    private transcriber: DictationTranscriber,
    private folder = STATE_DIR,
  ) {
    super();
  }

  /** A recording left running by a page that was closed meanwhile is dropped; each recording gets its own file. */
  start(): string {
    if (this.current) void this.cancel();
    const wav = resolve(this.folder, `dictation-${++this.count}.wav`);
    const recording = new LiveRecording(this.recordBin, () => void this.cancel());
    const take = new DictationTake(recording, wav, this.transcriber);
    take.preview((words) => this.emit("words", words));
    this.current = take;
    return "Listening…";
  }

  async finish(): Promise<string> {
    const words = await this.takeCurrent().finish();
    if (!words) throw new Error(NOTHING_HEARD);
    return words;
  }

  async cancel(): Promise<string> {
    const take = this.current;
    this.current = undefined;
    if (!take) return NOT_LISTENING;
    await take.discard();
    return "Recording discarded.";
  }

  private takeCurrent(): DictationTake {
    const take = this.current;
    if (!take) throw new Error(NOT_LISTENING);
    this.current = undefined;
    return take;
  }
}

/** Text mode: no mic to record from, so no words ever come. */
export class UnavailableDictation extends EventEmitter implements DictationControl {
  start(): string {
    throw new Error(NO_MIC);
  }

  finish(): Promise<string> {
    return Promise.reject(new Error(NO_MIC));
  }

  cancel(): Promise<string> {
    return Promise.resolve(NOT_LISTENING);
  }
}
