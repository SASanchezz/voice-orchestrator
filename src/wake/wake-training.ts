import type { WakeRecordingView } from "../ui/wake-recording-views.js";
import type { RecordingLabel, TrainingCommand } from "./training-command.js";
import { deletedReply, samplesReply, trainedReply, triedReply } from "./training-replies.js";
import type { RecordingRef, WakeRecordings } from "./wake-recordings.js";
import type { WakeSwitch } from "./wake-switch.js";

const BUSY = "Wait a moment: the last recording or training hasn't finished.";

/** The web UI's Train wake word dialog: record yourself, listen back, delete poor takes, train, and try it out. */
export interface WakeTrainingControl {
  status(): Promise<string>;
  record(label: RecordingLabel): Promise<string>;
  train(): Promise<string>;
  tryOut(): Promise<string>;
  recordings(): WakeRecordingView[];
  /** The recording's file, to play back; throws when there is none. */
  recordingPath(label: RecordingLabel, name: string): string;
  deleteRecordings(recordings: RecordingRef[]): Promise<string>;
}

type Listener = Pick<WakeSwitch, "pausedDuring" | "state">;
type TrainingSteps = Pick<TrainingCommand, "samples" | "record" | "train" | "tryOut">;
type Recordings = Pick<WakeRecordings, "list" | "pathOf" | "deleteAll">;

/**
 * Trains the wake word in sensors/wake, one step at a time. The listener is paused while a step uses the mic or the
 * model, so it doesn't wake on a training recording, and starts again afterwards with the newly trained model.
 */
export class WakeTraining implements WakeTrainingControl {
  private busy = false;

  constructor(
    private command: TrainingSteps,
    private listener: Listener,
    private files: Recordings,
  ) {}

  async status(): Promise<string> {
    return samplesReply(await this.command.samples());
  }

  record(label: RecordingLabel): Promise<string> {
    return this.pausingListener(async () => samplesReply(await this.command.record(label)));
  }

  train(): Promise<string> {
    return this.pausingListener(async () => trainedReply(await this.command.train(), this.listener.state));
  }

  tryOut(): Promise<string> {
    return this.pausingListener(async () => triedReply(await this.command.tryOut()));
  }

  recordings(): WakeRecordingView[] {
    return this.files.list();
  }

  recordingPath(label: RecordingLabel, name: string): string {
    return this.files.pathOf(label, name);
  }

  /** Not while training reads the recordings, or one is being made; the listener needs no pause for it. */
  deleteRecordings(recordings: RecordingRef[]): Promise<string> {
    return this.oneAtATime(async () => {
      this.files.deleteAll(recordings);
      return `${deletedReply(recordings.length)} ${await this.status()}`;
    });
  }

  private pausingListener(step: () => Promise<string>): Promise<string> {
    return this.oneAtATime(() => this.listener.pausedDuring(step));
  }

  /** Two at once would record over each other, or train on a half-written recording. */
  private async oneAtATime(step: () => Promise<string>): Promise<string> {
    if (this.busy) throw new Error(BUSY);
    this.busy = true;
    try {
      return await step();
    } finally {
      this.busy = false;
    }
  }
}

/** Text mode has no mic, and the listener may not be set up: every step says why it can't be done. */
export class UnavailableWakeTraining implements WakeTrainingControl {
  constructor(private reason: string) {}

  status(): Promise<string> {
    return this.refuse();
  }

  record(): Promise<string> {
    return this.refuse();
  }

  train(): Promise<string> {
    return this.refuse();
  }

  tryOut(): Promise<string> {
    return this.refuse();
  }

  recordings(): WakeRecordingView[] {
    return [];
  }

  recordingPath(): string {
    throw new Error(this.reason);
  }

  deleteRecordings(): Promise<string> {
    return this.refuse();
  }

  private refuse(): Promise<string> {
    return Promise.reject(new Error(this.reason));
  }
}
