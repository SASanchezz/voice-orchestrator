import { readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import type { WakeTrainingControl } from "../../wake/wake-training.js";
import { sendJson } from "./changes-routes.js";
import { HTTP_STATUS } from "./http-error.js";
import { wakeRecordingFileBody } from "./request-body.js";
import type { UiAccess } from "./ui-access.js";

export const WAKE_RECORDINGS_PATH = "/api/wake-training/recordings";
const RECORDING_FILE_PATH = /^\/api\/wake-training\/recordings\/([^/]+)\/([^/]+)$/;

type Recordings = Pick<WakeTrainingControl, "recordings" | "recordingPath">;

/** The Train wake word dialog's list of your recordings, and each one's audio to play back. */
export class WakeRecordingRoutes {
  constructor(
    private access: UiAccess,
    private training: Recordings,
  ) {}

  handles(url: URL): boolean {
    return url.pathname === WAKE_RECORDINGS_PATH || RECORDING_FILE_PATH.test(url.pathname);
  }

  route(url: URL, res: ServerResponse): void {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const file = url.pathname.match(RECORDING_FILE_PATH);
    if (file) return this.sendRecording(file, res);
    sendJson(res, this.training.recordings());
  }

  private sendRecording([, label, name]: RegExpMatchArray, res: ServerResponse): void {
    const recording = wakeRecordingFileBody.parse({ label, name });
    const audio = readFileSync(this.training.recordingPath(recording.label, recording.name));
    res.writeHead(HTTP_STATUS.ok, { "content-type": "audio/wav", "cache-control": "no-store" });
    res.end(audio);
  }
}
