import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import { DictationTake, type DictationTranscriber } from "./dictation-take.js";
import { LiveRecording } from "./live-recording.js";
import { prepareRecording, type RecordingTools } from "./recording-tools.js";

const NOT_LISTENING = "The mic isn't recording; click it to start.";
const NO_MIC = "There is no mic in text mode.";

/**
 * One recording at a time from the Mac's mic: start, then finish with your words, or cancel. Your words so far come
 * as "words"; "limit" says a recording went on so long that it should be ended now.
 */
export interface DictationControl {
  /** sox and whisper.cpp are there to record with. */
  prepare(): Promise<void>;
  start(): string;
  /** Your words, or "" when nothing was said. */
  finish(): Promise<string>;
  cancel(): Promise<string>;
  on(event: "words", listener: (words: string) => void): this;
  on(event: "limit", listener: () => void): this;
}

/**
 * Records from the Mac's mic with sox, and turns it into text with whisper.cpp while you speak and once more at the
 * end. The talk key, gestures, the wake word and the pages' mic buttons all record through it.
 */
export class Dictation extends EventEmitter implements DictationControl {
  private current?: DictationTake;
  private count = 0;

  constructor(
    private tools: RecordingTools,
    private transcriber: DictationTranscriber,
    private folder = STATE_DIR,
  ) {
    super();
  }

  prepare(): Promise<void> {
    return prepareRecording(this.tools);
  }

  /** A recording still running is dropped; each recording gets its own file. */
  start(): string {
    if (this.current) void this.cancel();
    const wav = resolve(this.folder, `dictation-${++this.count}.wav`);
    const recording = new LiveRecording(this.tools.recordBin, () => this.emit("limit"));
    const take = new DictationTake(recording, wav, this.transcriber);
    take.preview((words) => this.emit("words", words));
    this.current = take;
    return "Listening…";
  }

  async finish(): Promise<string> {
    return await this.takeCurrent().finish();
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
  prepare(): Promise<void> {
    return Promise.resolve();
  }

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
