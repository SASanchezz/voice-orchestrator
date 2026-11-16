import { CrashBackoff } from "../orchestrator/model/crash-backoff.js";
import { RestartingProcess, type RestartBackoff, type SensorCommand } from "./restarting-process.js";
import { SensorLines, type SensorOutput } from "./sensor-lines.js";

const LOG = "[gestures]";
const SETUP_HINT = "Set up sensors/gestures as its README says, or fix sensors.gestures in config/config.yaml.";
export const CAMERA_OFF = "The camera is off: it runs only while Gestures are on in the web UI.";

/** Asks for a JPEG of the camera's next frame at `path`, answered by a `snapshot` line with the same `id`. */
export interface SnapshotRequest {
  id: string;
  path: string;
}

/**
 * Runs the gesture sensor and reads its JSON lines; it is started again if it dies, waiting longer each time until
 * it gets as far as `ready`. Commands such as snapshot requests go to its stdin.
 */
export class GestureProcess {
  private process: RestartingProcess;

  constructor(command: SensorCommand, output: SensorOutput, backoff: RestartBackoff = new CrashBackoff()) {
    const lines = new SensorLines(output, () => backoff.reset());
    const named = { ...command, log: LOG, setupHint: SETUP_HINT };
    this.process = new RestartingProcess(
      named,
      { line: (text) => lines.read(text), stopped: () => output.sensorStopped() },
      backoff,
    );
  }

  start(): void {
    this.process.start();
  }

  /** For good: nothing it still prints is acted on, and it isn't started again. */
  stop(): void {
    this.process.stop();
  }

  /** Throws while the sensor isn't running: stopped, or waiting to be started again. */
  requestSnapshot(request: SnapshotRequest): void {
    if (!this.process.isRunning()) throw new Error(CAMERA_OFF);
    this.process.send(JSON.stringify({ cmd: "snapshot", ...request }));
  }
}
