import type { VoiceCancel } from "../../orchestrator/conversation/voice-cancel.js";
import type { VoiceHold } from "../../orchestrator/conversation/voice-hold.js";
import type { Orchestrator } from "../../orchestrator/orchestrator.js";
import type { GestureControl } from "../../sensors/gesture-switch.js";
import type { GestureStateName, SpeechModeName, VoiceInputName, VoiceOfferView } from "../protocol.js";

/** The operator's parts that know about your voice message. */
export interface VoiceParts {
  orchestrator: Orchestrator;
  voiceHold: VoiceHold;
  voiceCancel: VoiceCancel;
}

/**
 * The voice side of the page: how replies are spoken, whether you're talking, whether gestures can talk for you,
 * and a voice message waiting for you.
 */
export class VoiceViews {
  private orchestrator: Orchestrator;
  private hold: VoiceHold;
  private cancel: VoiceCancel;

  constructor(
    { orchestrator, voiceHold, voiceCancel }: VoiceParts,
    private gestureControl: GestureControl,
  ) {
    this.orchestrator = orchestrator;
    this.hold = voiceHold;
    this.cancel = voiceCancel;
  }

  get speechMode(): SpeechModeName {
    return this.orchestrator.speechMode;
  }

  get gestures(): GestureStateName {
    return this.gestureControl.state;
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
