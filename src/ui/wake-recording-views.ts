// The Train wake word dialog's list of your recordings. No imports, so the server (Node) and the page (browser) both
// compile it.

/** `wake`: you saying the wake word. `other`: other talk, or your room. */
export type WakeRecordingLabel = "wake" | "other";

/** One training recording, to play back and delete when it's poor. */
export interface WakeRecordingView {
  label: WakeRecordingLabel;
  /** Its file name in sensors/wake/data/<label>/. */
  name: string;
  /** ISO time it was recorded. */
  recordedAt: string;
}
