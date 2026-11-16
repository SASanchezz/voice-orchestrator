import { CrashBackoff } from "../orchestrator/model/crash-backoff.js";
import { RestartingProcess, type RestartBackoff, type SensorCommand } from "../sensors/restarting-process.js";
import { readWakeLine, type WakeEvent } from "./wake-event.js";
import type { WakeListener } from "./wake-talk.js";

const LOG = "[wake word]";
const SETUP_HINT = "Set up sensors/wake as its README says, or fix sensors.wakeWord in config/config.yaml.";

/**
 * Runs the wake listener (sensors/wake) and passes on what it hears. It is started again if it dies, waiting longer
 * each time until it gets as far as `ready`. While it runs, the mic is open but its audio stays inside that process.
 */
export class WakeProcess {
  private process: RestartingProcess;

  constructor(
    command: SensorCommand,
    private listener: WakeListener,
    private backoff: RestartBackoff = new CrashBackoff(),
  ) {
    const named = { ...command, log: LOG, setupHint: SETUP_HINT };
    const output = { line: (text: string) => this.read(text), stopped: () => listener.sensorStopped() };
    this.process = new RestartingProcess(named, output, backoff);
  }

  start(): void {
    this.process.start();
  }

  /** For good: the mic goes off, and nothing it still prints is acted on. */
  stop(): void {
    this.process.stop();
  }

  private read(line: string): void {
    const parsed = readWakeLine(line);
    if (parsed.success) this.handle(parsed.data);
    else console.error(`${LOG} skipped a line it couldn't read: ${line}`);
  }

  private handle(event: WakeEvent): void {
    switch (event.type) {
      case "ready":
        this.backoff.reset(); // it got as far as listening: the next crash restarts it quickly again
        return this.listener.listening(event.model);
      case "error":
        return console.error(`${LOG} ${event.message}`);
      case "wake":
        return this.listener.heard(event.score);
      case "speech_end":
      case "stop_word":
      case "no_speech":
        return; // you may pause to think: a wake word recording ends only on "finish", or Escape to discard it
    }
  }
}
