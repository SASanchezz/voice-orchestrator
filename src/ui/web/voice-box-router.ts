// The server tells a page about the recording meant for it, however it was started. It goes to the composer, unless a
// drafted reply's 🎙 started it: then that reply's box gets it, until the recording ends.

import type { VoiceBoxEvent } from "../voice-box-protocol.js";
import { onServerEvent } from "./api.js";
import type { BoxNews } from "./box-news.js";
import { PAGE_ID } from "./page-id.js";

/** Each recording ends with exactly one of these. */
const ENDINGS = new Set<VoiceBoxEvent["kind"]>(["send", "kept", "ended", "cancelled"]);

let claimed: BoxNews | undefined;

export function routeVoiceBoxes(events: EventSource, composer: BoxNews): void {
  onServerEvent(events, "voice_box", ({ page, event }) => {
    if (page !== PAGE_ID) return;
    const news = claimed ?? composer;
    news.receive(event);
    if (ENDINGS.has(event.kind)) claimed = undefined;
  });
}

/** The next recording, started by this box's 🎙, fills this box instead of the composer. */
export function claimVoiceBox(news: BoxNews): void {
  claimed = news;
}

/** A box going away gives the recordings back to the composer. */
export function releaseVoiceBox(news: BoxNews): void {
  if (claimed === news) claimed = undefined;
}
