// While the wake word trains in the background: how long it has run and what it is doing, in the Train window's
// status line, ticking every second.

import type { WakeTrainingView } from "../protocol.js";

const TICK_MS = 1000;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
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
    this.show(`Training for ${TrainingClock.elapsed(startedAt)}: ${step || FIRST_STEP}`);
  }

  /** As m:ss. */
  private static elapsed(startedAt: number): string {
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / MS_PER_SECOND));
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const rest = String(seconds % SECONDS_PER_MINUTE).padStart(2, "0");
    return `${minutes}:${rest}`;
  }
}
