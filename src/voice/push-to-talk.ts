import type { AppConfig } from "../config/app-config.js";
import { startRecorder, type Recording } from "./recorder.js";
import { discardRecording, finishAtLimit, MAX_RECORDING_MS, transcribeRecording } from "./recording-end.js";
import { RecordingFiles } from "./recording-files.js";
import { prepareRecording } from "./recording-tools.js";
import { DISCARD_SOUND, playSound, START_SOUND } from "./sounds.js";
import type { Transcriber } from "./transcriber.js";
import { UtteranceMerger } from "./utterance-merger.js";
import type { VoiceInputState } from "./voice-io.js";

/** Hold the key -> sox records -> release -> whisper.cpp -> text; a recording started while the previous one is transcribed joins it. */
export class PushToTalk {
  private current?: Recording;
  private files = new RecordingFiles();
  private merger: UtteranceMerger;
  private deliver: (message: string) => void = () => {};

  constructor(
    private cfg: AppConfig["voice"],
    private transcriber: Transcriber,
    private maxRecordingMs = MAX_RECORDING_MS,
  ) {
    this.merger = new UtteranceMerger((message) => this.deliver(message));
  }

  prepare(): Promise<void> {
    return prepareRecording(this.cfg);
  }

  onMessage(deliver: (message: string) => void): void {
    this.deliver = deliver;
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
    playSound(START_SOUND);
  }

  /** The key is free for the next recording while this one is stopped and transcribed. */
  release(): void {
    const recording = this.current;
    this.current = undefined;
    if (recording) void transcribeRecording(recording, this.transcriber, this.merger);
  }

  /** Drops what you're saying and what you said just before it, even if still being transcribed: nothing is sent. */
  discard(): void {
    const recording = this.current;
    this.current = undefined;
    this.merger.discard();
    if (recording) void discardRecording(recording);
    playSound(DISCARD_SOUND);
  }

  private stopAtLimit(): void {
    const recording = this.current;
    this.current = undefined; // first, so a late key release can't send the recording a second time
    if (recording) void finishAtLimit(recording, this.transcriber, this.merger);
  }
}
