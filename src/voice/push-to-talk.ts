import { EventEmitter } from "node:events";
import type { AppConfig } from "../config/app-config.js";
import { startRecorder, type Recording } from "./recorder.js";
import { discardRecording, finishAtLimit, MAX_RECORDING_MS, transcribeRecording } from "./recording-end.js";
import { RecordingFiles } from "./recording-files.js";
import { prepareRecording } from "./recording-tools.js";
import { DISCARD_SOUND, playSound, START_SOUND } from "./sounds.js";
import type { Transcriber } from "./transcriber.js";
import { TalkDraft } from "./talk-draft.js";
import { UtteranceMerger } from "./utterance-merger.js";
import type { VoiceInputState } from "./voice-io.js";

/**
 * Hold the key -> sox records -> release -> whisper.cpp -> text; a recording started while the previous one is
 * transcribed joins it. "message" brings what you said; "draft" your words so far, again and again while you speak.
 */
export class PushToTalk extends EventEmitter<{ message: [string]; draft: [string] }> {
  private current?: Recording;
  private files = new RecordingFiles();
  private merger = new UtteranceMerger((message) => this.emit("message", message));
  private draft: TalkDraft;

  constructor(
    private cfg: AppConfig["voice"],
    private transcriber: Transcriber,
    private maxRecordingMs = MAX_RECORDING_MS,
  ) {
    super();
    this.draft = new TalkDraft(transcriber, (words) => this.emit("draft", words));
  }

  prepare(): Promise<void> {
    return prepareRecording(this.cfg);
  }

  state(): VoiceInputState {
    if (this.current) return "recording";
    return this.merger.isHolding() ? "held" : "idle";
  }

  begin(): void {
    const wav = this.files.next();
    const slot = this.merger.begin();
    const recorder = startRecorder(this.cfg.recordBin, wav);
    const limit = setTimeout(() => this.stopAtLimit(), this.maxRecordingMs);
    this.current = { slot, wav, startedAt: Date.now(), recorder, limit };
    this.draft.follow(wav);
    playSound(START_SOUND);
  }

  /** The key is free for the next recording while this one is stopped and transcribed. */
  release(): void {
    const recording = this.endRecordingAndDraft();
    if (recording) void transcribeRecording(recording, this.transcriber, this.merger);
  }

  /** Drops what you're saying and what you said just before it, even if still being transcribed: nothing is sent. */
  discard(): void {
    const recording = this.endRecordingAndDraft();
    this.merger.discard();
    if (recording) void discardRecording(recording);
    playSound(DISCARD_SOUND);
  }

  private stopAtLimit(): void {
    const recording = this.endRecordingAndDraft(); // first, so a late key release can't send the recording a second time
    if (recording) void finishAtLimit(recording, this.transcriber, this.merger);
  }

  private endRecordingAndDraft(): Recording | undefined {
    const recording = this.current;
    this.current = undefined;
    this.draft.end();
    return recording;
  }
}
