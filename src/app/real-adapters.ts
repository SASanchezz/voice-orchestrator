import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import { SensorCamera } from "../camera/sensor-camera.js";
import type { AppConfig } from "../config/app-config.js";
import { CONFIG_PATH, NOTES_PATH } from "../config/paths.js";
import { MacBrowserPage } from "../macos/mac-browser-page.js";
import { MacPopups } from "../macos/mac-popups.js";
import { MacQuestionPanels } from "../macos/mac-question-panels.js";
import { AssistantNotes } from "../orchestrator/memory/assistant-notes.js";
import { DestructiveList } from "../safety/destructive-list.js";
import type { GestureControl } from "../sensors/gesture-switch.js";
import type { SensorSnapshots } from "../sensors/sensor-snapshots.js";
import { MacScreen } from "../screen/mac-screen.js";
import { MacHotkey } from "../voice/hotkey.js";
import { HotkeyTalk } from "../voice/hotkey-talk.js";
import { MacVoice } from "../voice/mac-voice.js";
import { PushToTalk } from "../voice/push-to-talk.js";
import { RepeatingSpeaker } from "../voice/repeating-speaker.js";
import { SaySpeaker } from "../voice/say-speaker.js";
import { TalkSwitch } from "../voice/talk-switch.js";
import { Transcriber } from "../voice/transcriber.js";
import type { Adapters } from "./build-app.js";

/**
 * The real world: what main.ts made first (your voice, the assistant's checked agent), the screen, the camera
 * (through the gesture sensor's `snapshots`), pop-ups, your files and the Agent SDK.
 */
export async function realAdapters(
  madeFirst: Pick<Adapters, "voice" | "assistantAgent">,
  gestures: GestureControl,
  snapshots: SensorSnapshots,
): Promise<Adapters> {
  const screen = await MacScreen.create();
  const popups = await MacPopups.create();
  const questionPanels = await MacQuestionPanels.create(); // after MacPopups: the helper is built by then
  const devices = {
    ...madeFirst,
    screen,
    camera: SensorCamera.create(snapshots),
    gestures,
    popups,
    notices: popups,
    browser: new MacBrowserPage(),
  };
  return { ...devices, questionPanels, ...filesAndModel() };
}

/** config/destructive.yaml (hot-reloaded), config/config.yaml, config/notes.md and the Agent SDK. */
function filesAndModel(): Pick<Adapters, "destructive" | "configFile" | "notes" | "query" | "explainCommands"> {
  const destructive = new DestructiveList();
  destructive.watchForChanges();
  const notes = new AssistantNotes(NOTES_PATH);
  return { destructive, configFile: CONFIG_PATH, notes, query: sdkQuery, explainCommands: true };
}

/** Your voice on macOS, and the mic switch that lets gestures talk as well as the hotkey. */
export interface MacVoiceParts {
  voice: MacVoice;
  talk: TalkSwitch;
}

/** Hold the hotkey to talk; replies are spoken with `say`. */
export function macVoice(settings: AppConfig["voice"]): MacVoiceParts {
  const pushToTalk = new PushToTalk(settings, new Transcriber(settings));
  const speaker = new RepeatingSpeaker(new SaySpeaker(settings));
  const talk = new TalkSwitch(pushToTalk, () => speaker.stop());
  const hotkey = new HotkeyTalk(new MacHotkey(settings.hotkey), talk);
  return { voice: new MacVoice(pushToTalk, speaker, hotkey), talk };
}
