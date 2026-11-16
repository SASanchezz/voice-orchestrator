import type { WakeTrainingControl } from "../../wake/wake-training.js";
import { wakeRecordingBody, wakeRecordingsDeleteBody } from "./request-body.js";
import type { Route } from "./route-table.js";

/** The Train wake word dialog's buttons; each records from the mic, trains or deletes, and answers when it's done. */
export function wakeTrainingRoutes(training: WakeTrainingControl): [RegExp, Route][] {
  return [
    [/^\/api\/wake-training\/status$/, () => training.status()],
    [/^\/api\/wake-training\/record$/, (b) => training.record(wakeRecordingBody.parse(b).label)],
    [/^\/api\/wake-training\/train$/, () => training.train()],
    [/^\/api\/wake-training\/try$/, () => training.tryOut()],
    [/^\/api\/wake-training\/delete$/, (b) => training.deleteRecordings(wakeRecordingsDeleteBody.parse(b).recordings)],
  ];
}
