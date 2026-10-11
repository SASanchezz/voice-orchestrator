import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import type { AppConfig } from "../config/app-config.js";
import { NOTES_PATH } from "../config/paths.js";
import { MacPermissionDialogs } from "../macos/permission-dialog.js";
import { AssistantNotes } from "../orchestrator/memory/assistant-notes.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { MacScreen } from "../screen/mac-screen.js";
import { MacHotkey } from "../voice/hotkey.js";
import { MacVoice } from "../voice/mac-voice.js";
import { PushToTalk } from "../voice/push-to-talk.js";
import { SaySpeaker } from "../voice/say-speaker.js";
import { Transcriber } from "../voice/transcriber.js";
import type { VoiceIO } from "../voice/voice-io.js";
import type { Adapters } from "./build-app.js";

/** The real world: config/destructive.yaml (hot-reloaded), the screen, pop-ups, config/notes.md and the Agent SDK. */
export async function realAdapters(voice: VoiceIO): Promise<Adapters> {
  const destructive = new DestructiveList();
  destructive.watchForChanges();
  const screen = await MacScreen.create();
  const popups = await MacPermissionDialogs.create();
  const notes = new AssistantNotes(NOTES_PATH);
  return { destructive, voice, screen, notes, query: sdkQuery, explainCommands: true, popups };
}

/** Hold the hotkey to talk; replies are spoken with `say`. */
export function macVoice(settings: AppConfig["voice"]): MacVoice {
  const pushToTalk = new PushToTalk(settings, new Transcriber(settings));
  return new MacVoice(pushToTalk, new SaySpeaker(settings), new MacHotkey(settings.hotkey));
}
