import type { VoiceBox } from "./voice-box.js";

const NO_BOX = "No message box is open to take your words.";

/**
 * Which box takes the next recording: the one whose mic button was just clicked, or else the one that came up or was
 * used last and is still open, page or pop-up. Clicking another one before you talk switches to it.
 */
export class BoxChooser {
  /** The oldest first. */
  private recent: VoiceBox[] = [];
  private claimed?: VoiceBox;

  /** It came up, or you clicked or came to it. */
  used(box: VoiceBox): void {
    this.recent = [...this.recent.filter((other) => other !== box && other.isOpen()), box];
  }

  /** It was hidden or closed. */
  forget(box: VoiceBox): void {
    this.recent = this.recent.filter((other) => other !== box);
  }

  /** Its mic button starts the next recording. */
  claim(box: VoiceBox): void {
    this.claimed = box;
  }

  /** The next recording started: a claim counts for that one only. */
  started(): void {
    this.claimed = undefined;
  }

  hasBox(): boolean {
    return this.openBoxes().length > 0;
  }

  box(): VoiceBox {
    const [latest] = this.openBoxes();
    if (!latest) throw new Error(NO_BOX);
    return latest;
  }

  /** The claimed one first, then the latest used. */
  private openBoxes(): VoiceBox[] {
    const candidates = this.claimed ? [this.claimed, ...this.recent.toReversed()] : this.recent.toReversed();
    return candidates.filter((box) => box.isOpen());
  }
}
