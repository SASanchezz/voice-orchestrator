import type { SpeechMode } from "../config/app-config.js";
import type { VoiceInputState } from "../voice/voice-io.js";
import type { OperatorLoop } from "./conversation/operator-loop.js";
import type { SpeechOutput } from "./conversation/speech-output.js";
import type { TurnContext } from "./conversation/turn-context.js";

/** What the web UI can do with the operator: talk to it by typing, tell it about clicks, clear it, set its speech. */
export class Orchestrator {
  constructor(
    private loop: OperatorLoop,
    private context: TurnContext,
    private speech: SpeechOutput,
  ) {}

  /** A message typed in the UI; handled like speech, answered on screen. */
  receiveTyped(text: string): void {
    this.loop.enqueue({ kind: "user", text, source: "ui" });
  }

  /** Keep the model in sync with clicks, without spending a turn on them. */
  noteUiAction(text: string): void {
    this.context.addUiNote(`[UI] ${text}`);
  }

  /**
   * Restarts the model's context once any reply in progress is done, carrying only a handoff the model
   * writes first (a short summary and key facts); the saved exchanges are dropped. Resolves once the
   * handoff is saved to memory. Projects, sessions and their history are untouched.
   */
  clearConversation(): Promise<void> {
    // queued like a message, so it runs after what you already said and nothing sent meanwhile can take the handoff's turn
    return new Promise((saved, failed) => this.loop.enqueue({ kind: "clear", saved, failed }));
  }

  get speechMode(): SpeechMode {
    return this.speech.speechMode;
  }

  /** Whether you're talking, or your words are held a moment before they're sent. */
  get voiceInput(): VoiceInputState {
    return this.speech.voiceInput;
  }

  setSpeechMode(mode: SpeechMode): void {
    this.speech.setSpeechMode(mode);
  }
}
