import type { OperatorParts } from "./build-operator.js";
import type { RouteHandlers } from "../ui/server/route-table.js";
import { VoiceOfferActions } from "../ui/server/voice-offer-actions.js";
import { VoiceViews } from "../ui/server/voice-views.js";
import type { OperatorDevices } from "./operator-types.js";

/** The voice side of the page, with the Gestures and Wake word switches it shows, and whether training goes on. */
export function voiceViews(operator: OperatorParts, { gestures, wakeWord, wakeTraining }: OperatorDevices): VoiceViews {
  return new VoiceViews(operator, { gestures, wakeWord, wakeTraining });
}

/** What the page's voice message buttons, its mic button, the Gestures and Wake word switches and wake word training act on. */
export function voiceHandlers(
  { voiceCancel, voiceHold }: OperatorParts,
  devices: Pick<OperatorDevices, "gestures" | "wakeWord" | "wakeTraining" | "dictation">,
): Pick<RouteHandlers, "voice" | "voiceOffers" | "gestures" | "wakeWord" | "wakeTraining" | "dictation"> {
  const { gestures, wakeWord, wakeTraining, dictation } = devices;
  return {
    voice: voiceCancel,
    voiceOffers: new VoiceOfferActions(voiceHold),
    gestures,
    wakeWord,
    wakeTraining,
    dictation,
  };
}
