import { readSensorLine, type SensorEvent, type SnapshotAnswer } from "./sensor-event.js";
import type { SensorListener } from "./sensor-router.js";

const LOG = "[gestures]";

/** Everything the sensor says: its gestures, its answers to snapshot commands, and that it stopped. */
export interface SensorOutput extends SensorListener {
  snapshotAnswered(answer: SnapshotAnswer): void;
}

/** Reads the sensor's stdout lines and passes on what they say; a line it can't read is logged and skipped. */
export class SensorLines {
  constructor(
    private output: SensorOutput,
    private onReady: () => void,
  ) {}

  read(line: string): void {
    const parsed = readSensorLine(line);
    if (parsed.success) this.handle(parsed.data);
    else console.error(`${LOG} skipped a line it couldn't read: ${line}`);
  }

  private handle(event: SensorEvent): void {
    switch (event.type) {
      case "ready":
        console.log(`${LOG} on (${event.recognizer} recognizer)`);
        return this.onReady();
      case "error":
        return console.error(`${LOG} ${event.message}`);
      case "gesture":
        console.log(`${LOG} ${event.name} ${event.phase} (${event.hand} hand)`);
        return this.output.receive(event);
      case "snapshot":
        return this.output.snapshotAnswered(event);
    }
  }
}
