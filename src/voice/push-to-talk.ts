import type { AppConfig } from "../config/app-config.js";
import { startRecorder, type Recording } from "./recorder.js";
import { abandonRecording, MAX_RECORDING_MS, transcribeRecording } from "./recording-end.js";
import { RecordingFiles } from "./recording-files.js";
import { prepareRecording } from "./recording-tools.js";
import { playSound, START_SOUND } from "./sounds.js";
import type { Transcriber } from "./transcriber.js";
import { UtteranceMerger } from "./utterance-merger.js";
import type { VoiceInputState } from "./voice-io.js";

const SECOND_MS = 1000;

/** Hold the key -> sox records -> release -> whisper.cpp -> text; quick follow-ups are joined into one message. */
export class PushToTalk {
  private current?: Recording;
  private files = new RecordingFiles();
  private merger: UtteranceMerger;
  private deliver: (message: string) => void = () => {};

  constructor(
    private cfg: AppConfig["voice"],
    private transcriber: Transcriber,
  ) {
    this.merger = new UtteranceMerger(cfg.mergeWindowSeconds * SECOND_MS, (message) => this.deliver(message));
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
    const limit = setTimeout(() => this.abandon(), MAX_RECORDING_MS);
    this.current = { slot, wav, startedAt: Date.now(), recorder, limit };
    playSound(START_SOUND);
  }

  /** The key is free for the next recording while this one is stopped and transcribed. */
  release(): void {
    const recording = this.current;
    this.current = undefined;
    if (recording) void transcribeRecording(recording, this.transcriber, this.merger);
  }

  private abandon(): void {
    const recording = this.current;
    this.current = undefined; // first, so a late key release can't send the partial recording
    if (recording) abandonRecording(recording, this.merger);
  }
}
