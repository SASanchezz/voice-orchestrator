import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { WakeRecordingView } from "../ui/wake-recording-views.js";
import { RECORDING_LABELS, type RecordingLabel } from "./training-command.js";

/** A recording's file name as sensors/wake makes it (its time, then .wav), and nothing that could leave its folder. */
export const RECORDING_NAME = /^[\w-]+\.wav$/;

/** Which recording: its kind, and its file name in that kind's folder. */
export interface RecordingRef {
  label: RecordingLabel;
  name: string;
}

/** Your training recordings, kept by sensors/wake in data/<label>/: listed, played back and deleted from the web UI. */
export class WakeRecordings {
  constructor(private root: string) {}

  /** Oldest first, the wake word's before other talk. */
  list(): WakeRecordingView[] {
    return RECORDING_LABELS.flatMap((label) => this.listOf(label));
  }

  /** Throws when there is no such recording. */
  pathOf(label: RecordingLabel, name: string): string {
    const path = join(this.root, label, name);
    if (!RECORDING_NAME.test(name) || !existsSync(path)) throw new Error(`There is no recording ${label}/${name}.`);
    return path;
  }

  /** All of them, or none when one isn't there. */
  deleteAll(recordings: RecordingRef[]): void {
    const paths = recordings.map(({ label, name }) => this.pathOf(label, name));
    for (const path of paths) rmSync(path);
  }

  private listOf(label: RecordingLabel): WakeRecordingView[] {
    const folder = join(this.root, label);
    if (!existsSync(folder)) return [];
    const names = readdirSync(folder)
      .filter((name) => RECORDING_NAME.test(name))
      .toSorted();
    return names.map((name) => ({ label, name, recordedAt: statSync(join(folder, name)).mtime.toISOString() }));
  }
}
