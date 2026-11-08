import { alertLinesOf } from "./alert-lines.js";
import type { Arrival, ArrivalSink } from "./arrivals.js";

/** Messages that arrive within this long of the first one are announced together. */
export const GATHER_MS = 15_000;

export type Wait = (ms: number) => Promise<void>;

/** Says a short notice once, without a model turn; the assistant hears of it with your next message. */
export interface Announcer {
  announce(spoken: string, note: string): void;
}

/** Gathers arrivals for a few seconds, so a burst of messages becomes one notice instead of many. */
export class NewMessageAlerts implements ArrivalSink {
  private gathered: Arrival[] = [];

  constructor(
    private announcer: Announcer,
    private wait: Wait,
  ) {}

  heard(arrival: Arrival): void {
    this.gathered.push(arrival);
    if (this.gathered.length === 1) void this.announceAfterGathering();
  }

  private async announceAfterGathering(): Promise<void> {
    await this.wait(GATHER_MS);
    const { spoken, note } = alertLinesOf(this.gathered);
    this.gathered = [];
    this.announcer.announce(spoken, note);
  }
}
