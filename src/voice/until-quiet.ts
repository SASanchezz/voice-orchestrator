import { sleep } from "../shared/sleep.js";
import type { VoiceIO } from "./voice-io.js";

const USER_DONE_POLL_MS = 200;

/** You may have started talking meanwhile. */
export async function untilQuiet(voice: Pick<VoiceIO, "isListening">): Promise<void> {
  while (voice.isListening()) await sleep(USER_DONE_POLL_MS);
}
