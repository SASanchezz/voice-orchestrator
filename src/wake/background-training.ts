import type { WakeTrainingView } from "../ui/protocol.js";
import type { WakeRecordingView } from "../ui/wake-recording-views.js";
import { errorMessage } from "../shared/errors.js";
import type { RecordingLabel } from "./training-command.js";
import type { TrainingNews } from "./training-news.js";
import type { TrainingProgress } from "./training-progress.js";
import type { RecordingRef } from "./wake-recordings.js";
import { BUSY, type WakeTraining, type WakeTrainingControl, type WakeTrainingSteps } from "./wake-training.js";

const STARTED = "Training in the background: you can close this window. You'll hear how it went when it's done.";
const STILL_TRAINING = "Still training: you'll hear how it went when it's done.";

type Steps = WakeTrainingSteps & Pick<WakeTraining, "isBusy">;
type News = Pick<TrainingNews, "trained" | "failed">;
type Progress = Pick<TrainingProgress, "begin" | "view">;

/** Training takes minutes: it answers at once and goes on without the window, then says how it went. */
export class BackgroundTraining implements WakeTrainingControl {
  private training = false;

  constructor(
    private steps: Steps,
    private news: News,
    private progress: Progress,
  ) {}

  status(): Promise<string> {
    if (this.training) return Promise.resolve(STILL_TRAINING);
    return this.steps.status();
  }

  /** Until it ends, the dialog keeps its buttons off: another training or a changed recording would be refused. */
  isTraining(): boolean {
    return this.training;
  }

  /** How long the training has run, and what it is doing now. */
  progressView(): WakeTrainingView {
    return this.progress.view();
  }

  train(): Promise<string> {
    if (this.steps.isBusy()) return Promise.reject(new Error(BUSY));
    void this.trainAndTell();
    return Promise.resolve(STARTED);
  }

  record(label: RecordingLabel): Promise<string> {
    return this.steps.record(label);
  }

  tryOut(): Promise<string> {
    return this.steps.tryOut();
  }

  recordings(): WakeRecordingView[] {
    return this.steps.recordings();
  }

  recordingPath(label: RecordingLabel, name: string): string {
    return this.steps.recordingPath(label, name);
  }

  deleteRecordings(recordings: RecordingRef[]): Promise<string> {
    return this.steps.deleteRecordings(recordings);
  }

  private async trainAndTell(): Promise<void> {
    this.training = true;
    this.progress.begin();
    try {
      this.news.trained(await this.steps.train());
    } catch (error) {
      this.news.failed(errorMessage(error));
    } finally {
      this.training = false;
    }
  }
}
