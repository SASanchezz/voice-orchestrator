import { untilQuiet } from "./until-quiet.js";
import type { VoiceIO } from "./voice-io.js";

/** Runs things right away while you're quiet; while you talk or record, they wait and run in order once you stop. */
export class AfterTalking {
  private waiting: (() => void)[] = [];

  constructor(private voice: Pick<VoiceIO, "isListening">) {}

  run(action: () => void): void {
    const mayRunNow = this.waiting.length === 0 && !this.voice.isListening();
    if (mayRunNow) return action();
    this.waiting.push(action);
    if (this.waiting.length === 1) void this.runOnceQuiet();
  }

  private async runOnceQuiet(): Promise<void> {
    await untilQuiet(this.voice);
    const actions = this.waiting;
    this.waiting = [];
    for (const action of actions) action();
  }
}
