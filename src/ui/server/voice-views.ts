import type { VoiceCancel } from "../../orchestrator/conversation/voice-cancel.js";
import type { VoiceHold } from "../../orchestrator/conversation/voice-hold.js";
import type { Orchestrator } from "../../orchestrator/orchestrator.js";
import type { SpeechModeName, VoiceInputName, VoiceOfferView } from "../protocol.js";

/** The voice side of the page: how replies are spoken, whether you're talking, and a voice message waiting for you. */
export class VoiceViews {
  constructor(
    private orchestrator: Orchestrator,
    private hold: VoiceHold,
    private cancel: VoiceCancel,
  ) {}

  get speechMode(): SpeechModeName {
    return this.orchestrator.speechMode;
  }

  /** A spoken message queued behind a reply in progress shows too, since it can still be discarded. */
  get voiceInput(): VoiceInputName {
    const input = this.orchestrator.voiceInput;
    return input === "idle" && this.cancel.hasQueued() ? "queued" : input;
  }

  offer(): VoiceOfferView | undefined {
    return this.hold.waiting;
  }
}
