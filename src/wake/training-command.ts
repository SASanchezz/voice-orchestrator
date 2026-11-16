import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { SensorCommand } from "../sensors/restarting-process.js";
import type { TrainingProgress } from "./training-progress.js";
import {
  readTrainingLine,
  type SamplesEvent,
  type TrainedEvent,
  type TrainingEvent,
  type TriedEvent,
} from "./training-event.js";

/** What a training recording holds: the wake word, or any other talk and the room around you. */
export const RECORDING_LABELS = ["wake", "other"] as const;
export type RecordingLabel = (typeof RECORDING_LABELS)[number];

type TrainingEventType = TrainingEvent["type"];
type EventOf<Type extends TrainingEventType> = Extract<TrainingEvent, { type: Type }>;

/**
 * The wake listener's training commands (sensors/wake), each run once to its JSON result. Their progress goes to the
 * terminal, and its latest line to `progress`; a failure is thrown with the listener's own reason.
 */
export class TrainingCommand {
  constructor(
    private python: SensorCommand,
    private recordBin: string,
    private progress: Pick<TrainingProgress, "heard">,
  ) {}

  samples(): Promise<SamplesEvent> {
    return this.run(["samples"], "samples");
  }

  record(label: RecordingLabel): Promise<SamplesEvent> {
    return this.run(["record", "--label", label, "--record-bin", this.recordBin], "samples");
  }

  train(): Promise<TrainedEvent> {
    return this.run(["train"], "trained");
  }

  tryOut(): Promise<TriedEvent> {
    return this.run(["try", "--record-bin", this.recordBin], "tried");
  }

  private async run<Type extends TrainingEventType>(args: string[], expected: Type): Promise<EventOf<Type>> {
    const event = await this.lastEvent([...this.python.args, ...args]);
    if (event.type === "error") throw new Error(event.message);
    if (!TrainingCommand.isOfType(event, expected)) throw new Error(`Wake word training answered "${event.type}".`);
    return event;
  }

  private static isOfType<Type extends TrainingEventType>(event: TrainingEvent, type: Type): event is EventOf<Type> {
    return event.type === type;
  }

  private lastEvent(args: string[]): Promise<TrainingEvent> {
    const child = spawn(this.python.bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    createInterface({ input: child.stderr }).on("line", (line) => this.showProgress(line));
    const events: TrainingEvent[] = [];
    createInterface({ input: child.stdout }).on("line", (line) => {
      const parsed = readTrainingLine(line);
      if (parsed.success) events.push(parsed.data);
    });
    return new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        const last = events.at(-1);
        if (last) resolve(last);
        else reject(new Error(`Wake word training stopped (exit code ${String(code)}) with no result.`));
      });
    });
  }

  private showProgress(line: string): void {
    console.error(line);
    this.progress.heard(line);
  }
}
