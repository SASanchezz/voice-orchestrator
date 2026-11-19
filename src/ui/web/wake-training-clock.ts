// While the wake word trains in the background: how long it has run and what it is doing, in the Train window's
// status line, ticking every second.

import type { WakeTrainingView } from "../protocol.js";
import { elapsedSince } from "./elapsed.js";

const TICK_MS = 1000;
const FIRST_STEP = "Starting…";

export class TrainingClock {
  private timer?: number;
  private training?: WakeTrainingView;

  constructor(private show: (text: string) => void) {}

  follow(training: WakeTrainingView): void {
    this.training = training;
    this.render();
    this.timer ??= window.setInterval(() => this.render(), TICK_MS);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.training = undefined;
  }

  private render(): void {
    if (!this.training) return;
    const { startedAt, step } = this.training;
    this.show(`Training for ${elapsedSince(startedAt)}: ${step || FIRST_STEP}`);
  }
}
