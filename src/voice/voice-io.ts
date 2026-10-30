/** idle; recording while the key is held; held while your words are transcribed and kept a moment in case you continue. */
export type VoiceInputState = "idle" | "recording" | "held";

export interface VoiceIO {
  onUtterance(cb: (text: string) => void): void;
  /** Your words so far, again and again while you speak; the full message still comes through onUtterance. */
  onDraft(cb: (words: string) => void): void;
  /** Fires the moment you start talking, before your words are known. */
  onPress(cb: () => void): void;
  speak(text: string): Promise<void>;
  stopSpeaking(): void;
  /** True from key press until your words are sent: events wait so Claude never talks over you or answers ahead of you. */
  isListening(): boolean;
  inputState(): VoiceInputState;
  /** Drops what you're saying, or your words held before they're sent: nothing is transcribed or sent. */
  discardInput(): void;
  start(): Promise<void>;
}
