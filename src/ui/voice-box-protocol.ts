/**
 * What happens to the recording a page's message box follows. It starts with the session your words go to (none for
 * the assistant), your words so far come again and again, and it ends one way: sent by the box with what it held,
 * kept there to edit, gone on without the box (an approval, or nothing said), or cancelled; the last two put back
 * what the box held.
 */
export type VoiceBoxEvent =
  | { kind: "started"; session?: string }
  | { kind: "words"; words: string }
  | { kind: "send"; words: string }
  | { kind: "kept"; words: string }
  | { kind: "ended" }
  | { kind: "cancelled" };

/** Each page only acts on the recordings meant for its own box. */
export interface VoiceBoxNews {
  page: string;
  event: VoiceBoxEvent;
}
