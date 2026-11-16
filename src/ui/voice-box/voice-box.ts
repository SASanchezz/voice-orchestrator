import type { VoiceBoxEvent } from "../voice-box-protocol.js";

/** Shows what happens to the recording it follows. */
export interface VoiceListener {
  tell(event: VoiceBoxEvent): void;
}

/** A text box your words can go into while you talk: a page's message box, or a pop-up's field. */
export interface VoiceBox extends VoiceListener {
  /** Still there to show your words: its page connected and not hidden, its pop-up open. */
  isOpen(): boolean;
}

/** What a pop-up with a text field reports: it came to the front or was clicked, or you clicked into its field. */
export interface PanelVoiceEvents {
  cameToFront(): void;
  /** A click into the field your words are filling: stop the recording and leave them there to edit. */
  editing(): void;
}
