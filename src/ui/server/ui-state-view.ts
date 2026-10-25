import type { UiState } from "../protocol.js";
import type { UiLookup } from "./ui-lookup.js";
import type { VoiceViews } from "./voice-views.js";
import type { WaitingViews } from "./waiting-views.js";

/** Everything the page shows that can change at any moment. */
export class UiStateView {
  constructor(
    private lookup: UiLookup,
    private waiting: WaitingViews,
    private voice: VoiceViews,
  ) {}

  /** Everything but the budget and the to-do list, which PageStateView adds. */
  state(): Omit<UiState, "budget" | "todo"> {
    return {
      projects: this.lookup.projectViews(),
      pending: this.waiting.requests(),
      questions: this.waiting.questionsAsked(),
      permissionMode: this.waiting.permissionMode,
      speechMode: this.voice.speechMode,
      gestures: this.voice.gestures,
      voiceInput: this.voice.voiceInput,
      voiceOffer: this.voice.offer(),
    };
  }
}
