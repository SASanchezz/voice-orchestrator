import type { SharedMic } from "../../voice/shared-mic.js";
import type { BoxChooser } from "../voice-box/box-chooser.js";
import type { PageBoxes } from "../voice-box/page-boxes.js";
import { pageBody } from "./request-body.js";

const ALREADY_RECORDING = "The mic is already recording.";

type Mic = Pick<SharedMic, "start" | "keep" | "cancel" | "state">;

/**
 * The pages' mic buttons on the shared mic: start a recording into this page's box, stop it to edit your words there,
 * or drop it. Each page also says when you come to it, and the notice panel's page when it is hidden, so a recording
 * started by the talk key or the wake word goes into the box you see.
 */
export class MicActions {
  constructor(
    private mic: Mic,
    private pages: PageBoxes,
    private chooser: BoxChooser,
  ) {}

  start(body: unknown): string {
    if (this.mic.state() === "recording") throw new Error(ALREADY_RECORDING);
    this.chooser.claim(this.pageBoxOf(body));
    this.mic.start("button");
    return "Listening…";
  }

  keep(): Promise<string> {
    return this.mic.keep();
  }

  async cancel(): Promise<string> {
    await this.mic.cancel();
    return "Recording discarded.";
  }

  pageUsed(body: unknown): string {
    this.chooser.used(this.pageBoxOf(body));
    return "Noted.";
  }

  pageHidden(body: unknown): string {
    this.chooser.forget(this.pageBoxOf(body));
    return "Noted.";
  }

  private pageBoxOf(body: unknown): ReturnType<PageBoxes["of"]> {
    return this.pages.of(pageBody.parse(body).page);
  }
}
