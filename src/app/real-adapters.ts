import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import type { AppConfig } from "../config/app-config.js";
import { CONFIG_PATH, NOTES_PATH } from "../config/paths.js";
import { MacBrowserPage } from "../macos/mac-browser-page.js";
import { MacPopups } from "../macos/mac-popups.js";
import { MacQuestionPanels } from "../macos/mac-question-panels.js";
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

/**
 * The real world: config/destructive.yaml (hot-reloaded), config/config.yaml, the screen, pop-ups, config/notes.md
 * and the Agent SDK.
 */
export async function realAdapters(voice: VoiceIO): Promise<Adapters> {
  const destructive = new DestructiveList();
  destructive.watchForChanges();
  const screen = await MacScreen.create();
  const popups = await MacPopups.create();
  const questionPanels = await MacQuestionPanels.create(); // after MacPopups: the helper is built by then
  const notes = new AssistantNotes(NOTES_PATH);
  const devices = { voice, screen, notes, query: sdkQuery, popups, notices: popups, browser: new MacBrowserPage() };
  return { ...devices, questionPanels, destructive, configFile: CONFIG_PATH, explainCommands: true };
}

/** Hold the hotkey to talk; replies are spoken with `say`. */
export function macVoice(settings: AppConfig["voice"]): MacVoice {
  const pushToTalk = new PushToTalk(settings, new Transcriber(settings));
  return new MacVoice(pushToTalk, new SaySpeaker(settings), new MacHotkey(settings.hotkey));
}
