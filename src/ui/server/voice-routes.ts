import type { Route, RouteHandlers } from "./route-table.js";

type VoiceHandlers = Pick<RouteHandlers, "mic" | "voice" | "frontSession" | "voiceOffers">;

/**
 * The mic buttons and the page you are using, discarding your voice message, whether one waiting goes with the draft's
 * files, and the project tab it goes to. Stopping a recording to edit it brings your words back to the page.
 */
export function voiceRoutes(h: VoiceHandlers): [RegExp, Route][] {
  return [
    [/^\/api\/dictation\/start$/, (b) => h.mic.start(b)],
    [/^\/api\/dictation\/cancel$/, () => h.mic.cancel()],
    [/^\/api\/dictation\/finish$/, () => h.mic.keep()],
    [/^\/api\/page-used$/, (b) => h.mic.pageUsed(b)],
    [/^\/api\/page-hidden$/, (b) => h.mic.pageHidden(b)],
    [/^\/api\/voice\/discard$/, () => h.voice.discardLatest()],
    [/^\/api\/front-session$/, (b) => h.frontSession.note(b)],
    [/^\/api\/draft$/, (b) => h.voiceOffers.draftChanged(b)],
    [/^\/api\/voice-offers\/(\w+)\/keep$/, (_b, m) => h.voiceOffers.keepInDraft(m[1])],
    [/^\/api\/voice-offers\/(\w+)\/discard$/, (_b, m) => h.voiceOffers.discard(m[1])],
  ];
}
