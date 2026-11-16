import type { PointingCue } from "../../sensors/pointing-cue.js";
import type { InputSink } from "./voice-hold.js";

const SENT = "Sent.";

/**
 * Your spoken words, sent from a page's message box with whatever it held and had attached: they reach the assistant
 * as speech, so it answers aloud, with a note if you pointed while saying them.
 */
export class SpokenMessages {
  constructor(
    private loop: InputSink,
    private pointing: Pick<PointingCue, "annotate">,
  ) {}

  receive(text: string): string {
    this.loop.enqueue({ kind: "user", text: this.pointing.annotate(text), source: "voice" });
    return SENT;
  }
}
