import type { ConfirmAsk } from "../../orchestrator/conversation/confirm-ask.js";
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
  confirmAsk: ConfirmAsk;
}

/**
 * The voice side of the page: how replies are spoken, whether you're talking, whether gestures can talk for you,
 * a voice message waiting for you, and the confirm phrases or go-ahead the assistant asked you for.
 */
export class VoiceViews {
  private orchestrator: Orchestrator;
  private hold: VoiceHold;
  private cancel: VoiceCancel;
  private confirmAsk: ConfirmAsk;

  constructor(
    { orchestrator, voiceHold, voiceCancel, confirmAsk }: VoiceParts,
    private gestureControl: GestureControl,
  ) {
    this.orchestrator = orchestrator;
    this.hold = voiceHold;
    this.cancel = voiceCancel;
    this.confirmAsk = confirmAsk;
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

  get confirmVerbs(): string[] {
    return this.confirmAsk.verbs;
  }

  get goAheadAsked(): boolean {
    return this.confirmAsk.goAheadAsked;
  }
}
