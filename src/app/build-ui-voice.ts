import type { OperatorParts } from "./build-operator.js";
import type { FrontSession } from "../ui/front-session.js";
import { BoxChooser } from "../ui/voice-box/box-chooser.js";
import { BoxRelay } from "../ui/voice-box/box-relay.js";
import { PageBoxes } from "../ui/voice-box/page-boxes.js";
import { PanelBoxes } from "../ui/voice-box/panel-box.js";
import type { LiveClients } from "../ui/server/live-clients.js";
import { MicActions } from "../ui/server/mic-actions.js";
import type { RouteHandlers } from "../ui/server/route-table.js";
import { VoiceOfferActions } from "../ui/server/voice-offer-actions.js";
import { VoiceViews } from "../ui/server/voice-views.js";
import type { SharedMic } from "../voice/shared-mic.js";
import type { OperatorDevices } from "./operator-types.js";

/** The voice side of the page, with the Gestures and Wake word switches it shows, and whether training goes on. */
export function voiceViews(operator: OperatorParts, { gestures, wakeWord, wakeTraining }: OperatorDevices): VoiceViews {
  return new VoiceViews(operator, { gestures, wakeWord, wakeTraining });
}

/** The boxes your words can go into, pages' and pop-ups', which one takes the next recording, and what it is told. */
export interface VoiceBoxes {
  pages: PageBoxes;
  panels: PanelBoxes;
  chooser: BoxChooser;
  relay: BoxRelay;
}

/** Each recording on the shared mic goes into the box you see, page or pop-up, and is sent from there. */
export function voiceBoxes(clients: LiveClients, front: FrontSession, mic: SharedMic): VoiceBoxes {
  const chooser = new BoxChooser();
  const relay = new BoxRelay(chooser, front, mic);
  relay.follow();
  return { pages: new PageBoxes(clients), panels: new PanelBoxes(chooser, relay), chooser, relay };
}

/**
 * What the page's voice message buttons, its mic button, the words its box sends, the Gestures and Wake word switches
 * and wake word training act on.
 */
export function voiceHandlers(
  { voiceCancel, voiceHold, spokenMessages }: OperatorParts,
  devices: Pick<OperatorDevices, "gestures" | "wakeWord" | "wakeTraining" | "mic">,
  boxes: VoiceBoxes,
): Pick<RouteHandlers, "voice" | "voiceOffers" | "gestures" | "wakeWord" | "wakeTraining" | "mic" | "spoken"> {
  const { gestures, wakeWord, wakeTraining, mic } = devices;
  return {
    voice: voiceCancel,
    voiceOffers: new VoiceOfferActions(voiceHold),
    gestures,
    wakeWord,
    wakeTraining,
    mic: new MicActions(mic, boxes.pages, boxes.chooser),
    spoken: spokenMessages,
  };
}
