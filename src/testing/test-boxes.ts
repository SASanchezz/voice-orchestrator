import type { VoiceBoxEvent } from "../ui/voice-box-protocol.js";
import type { VoiceBox } from "../ui/voice-box/voice-box.js";

/** Stands in for a page's box or a pop-up's field; it remembers what it was told, and can be closed. */
export class TestBox implements VoiceBox {
  told: VoiceBoxEvent[] = [];
  open = true;

  isOpen(): boolean {
    return this.open;
  }

  tell(event: VoiceBoxEvent): void {
    this.told.push(event);
  }
}
