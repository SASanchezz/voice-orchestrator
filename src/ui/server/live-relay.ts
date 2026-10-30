import type { DictationControl } from "../../voice/dictation.js";
import type { VoiceIO } from "../../voice/voice-io.js";
import type { Feed } from "../feed.js";
import type { FeedEntry } from "../feed-entry.js";
import type { ServerEvents } from "../protocol.js";
import type { SessionChats } from "../session-chats.js";
import type { LiveClients } from "./live-clients.js";

/** New lines in the assistant's chat and in session chats go straight to every open page. */
export function relayToClients(clients: LiveClients, feed: Feed, chats: SessionChats): void {
  feed.on("entry", (entry: FeedEntry) => clients.broadcast("feed", entry));
  feed.on("cleared", () => clients.broadcast("backlog", []));
  chats.on("message", (line: ServerEvents["chat"]) => clients.broadcast("chat", line));
  chats.on("cleared", (sessionId: string) => clients.broadcast("chat_cleared", sessionId));
}

/** Your words so far, while the page's mic button records, go into the message box of every open page. */
export function relayDictation(clients: LiveClients, dictation: DictationControl): void {
  dictation.on("words", (words) => clients.broadcast("dictation", words));
}

/** Your words so far, while you hold the talk key or gesture, go to the listening strip of every open page. */
export function relayVoiceDraft(clients: LiveClients, voice: Pick<VoiceIO, "onDraft">): void {
  voice.onDraft((words) => clients.broadcast("voice_draft", words));
}
