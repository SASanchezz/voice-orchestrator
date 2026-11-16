import type { WakeTrainingView } from "../ui/protocol.js";

/**
 * What the training is doing now, as the last progress line sensors/wake printed, and since when it runs.
 * The training commands write it; the web UI's Train wake word window reads it.
 */
export class TrainingProgress {
  private step = "";
  private startedAt = 0;

  constructor(private now: () => number = Date.now) {}

  begin(): void {
    this.step = "";
    this.startedAt = this.now();
  }

  /** A line sensors/wake printed; blank ones say nothing. */
  heard(line: string): void {
    const step = line.trim();
    if (step) this.step = step;
  }

  view(): WakeTrainingView {
    return { startedAt: this.startedAt, step: this.step };
  }
}
