import { CAMERA_OFF, type GestureProcess } from "./gesture-process.js";
import type { SnapshotAnswer } from "./sensor-event.js";

/** The sensor answers within a frame or two; this much longer means it is stuck. */
const ANSWER_TIMEOUT_MS = 5000;
const SENSOR_STOPPED = "The camera stopped before the snapshot was taken.";
const NO_ANSWER = "The camera didn't deliver a snapshot in time.";

type SnapshotSensor = Pick<GestureProcess, "requestSnapshot">;

interface WaitingSnapshot {
  taken: () => void;
  failed: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * Camera snapshots asked of the gesture sensor, each waiting for its answer. The sensor owns the camera, so there
 * are snapshots only while it runs, which is while Gestures are on.
 */
export class SensorSnapshots {
  private sensor?: SnapshotSensor;
  private waiting = new Map<string, WaitingSnapshot>();
  private lastId = 0;

  constructor(private answerTimeoutMs = ANSWER_TIMEOUT_MS) {}

  /** The sensor last built; it replaces the one before, which was stopped. */
  attach(sensor: SnapshotSensor): void {
    this.sensor = sensor;
  }

  /** Writes a JPEG of the camera's next frame to `path`. */
  async take(path: string): Promise<void> {
    if (!this.sensor) throw new Error(CAMERA_OFF);
    const id = String(++this.lastId);
    this.sensor.requestSnapshot({ id, path });
    return this.answerTo(id);
  }

  answered(answer: SnapshotAnswer): void {
    const waiting = this.stopWaiting(answer.id);
    if (!waiting) return;
    if (answer.ok) waiting.taken();
    else waiting.failed(new Error(`The camera snapshot failed: ${answer.message}`));
  }

  /** A stopped sensor answers nothing more. */
  sensorStopped(): void {
    for (const id of this.waiting.keys()) this.fail(id, SENSOR_STOPPED);
  }

  private answerTo(id: string): Promise<void> {
    return new Promise((taken, failed) => {
      const timer = setTimeout(() => this.fail(id, NO_ANSWER), this.answerTimeoutMs);
      this.waiting.set(id, { taken, failed, timer });
    });
  }

  private fail(id: string, reason: string): void {
    this.stopWaiting(id)?.failed(new Error(reason));
  }

  private stopWaiting(id: string): WaitingSnapshot | undefined {
    const waiting = this.waiting.get(id);
    this.waiting.delete(id);
    clearTimeout(waiting?.timer);
    return waiting;
  }
}
