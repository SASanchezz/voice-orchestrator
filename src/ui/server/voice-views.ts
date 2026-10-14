import type { VoiceHold } from "../../orchestrator/conversation/voice-hold.js";
import type { Orchestrator } from "../../orchestrator/orchestrator.js";
import type { SpeechModeName, VoiceInputName, VoiceOfferView } from "../protocol.js";

/** The voice side of the page: how replies are spoken, whether you're talking, and a voice message waiting for you. */
export class VoiceViews {
  constructor(
    private orchestrator: Orchestrator,
    private hold: VoiceHold,
  ) {}

  get speechMode(): SpeechModeName {
    return this.orchestrator.speechMode;
  }

  get voiceInput(): VoiceInputName {
    return this.orchestrator.voiceInput;
  }

  offer(): VoiceOfferView | undefined {
    return this.hold.waiting;
  }
}
