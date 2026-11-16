import { errorMessage } from "../../shared/errors.js";
import type { WordsHandoff } from "../../voice/mac-voice.js";
import type { SessionInFront } from "../../voice/worker-voice.js";
import type { VoiceBoxEvent } from "../voice-box-protocol.js";
import type { BoxChooser } from "./box-chooser.js";
import type { VoiceBox } from "./voice-box.js";

/** The shared mic: its news about the recording, and stopping it to edit; see SharedMic. */
interface RelayMic {
  on(event: "started" | "cancelled", listener: () => void): unknown;
  on(event: "words" | "kept", listener: (words: string) => void): unknown;
  keep(): Promise<string>;
  state(): string;
}

/**
 * Tells one box about the recording going on, whatever started it, so your words appear there as you speak: a page's
 * message box or a pop-up's field. When you send, the box sends them itself, with what it held. A box that closed
 * meanwhile can't, so your words go straight on, to the session in front when you started, or the assistant.
 */
export class BoxRelay implements WordsHandoff {
  private owner?: VoiceBox;

  constructor(
    private chooser: BoxChooser,
    private front: SessionInFront,
    private mic: RelayMic,
  ) {}

  follow(): void {
    this.mic.on("started", () => this.started());
    this.mic.on("words", (words) => this.tell({ kind: "words", words }));
    this.mic.on("kept", (words) => this.end({ kind: "kept", words }));
    this.mic.on("cancelled", () => this.end({ kind: "cancelled" }));
  }

  takes(words: string): boolean {
    if (!this.owner?.isOpen()) return false;
    this.end({ kind: "send", words });
    return true;
  }

  passedBy(): void {
    this.end({ kind: "ended" });
  }

  /** You clicked into a pop-up's field: the recording stops, and your words wait there to edit. */
  async stopToEdit(): Promise<void> {
    if (this.mic.state() !== "recording") return;
    try {
      this.end({ kind: "kept", words: await this.mic.keep() });
    } catch (error) {
      console.error(`[voice] couldn't stop the recording: ${errorMessage(error)}`);
    }
  }

  private started(): void {
    this.owner = this.chooser.hasBox() ? this.chooser.box() : undefined;
    this.chooser.started();
    const session = this.front.hasSession() ? this.front.session() : undefined;
    this.tell({ kind: "started", session });
  }

  private end(event: VoiceBoxEvent): void {
    this.tell(event);
    this.owner = undefined;
  }

  private tell(event: VoiceBoxEvent): void {
    this.owner?.tell(event);
  }
}
