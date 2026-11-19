import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import { SensorCamera } from "../camera/sensor-camera.js";
import { MacClipboard } from "../clipboard/mac-clipboard.js";
import type { AppConfig } from "../config/app-config.js";
import { CONFIG_PATH, NOTES_PATH, SKILLS_DIR } from "../config/paths.js";
import { MacBrowserPage } from "../macos/mac-browser-page.js";
import { MacChromeLinks } from "../macos/mac-chrome-links.js";
import { MacChatPanels } from "../macos/mac-chat-panels.js";
import { MacDraftPopups } from "../macos/mac-draft-popups.js";
import { MacConfirmPanels } from "../macos/mac-confirm-panels.js";
import { MacNoticePanel } from "../macos/mac-notice-panel.js";
import { MacPopups } from "../macos/mac-popups.js";
import { MacQuestionPanels } from "../macos/mac-question-panels.js";
import { AssistantNotes } from "../orchestrator/memory/assistant-notes.js";
import { DestructiveList } from "../safety/destructive-list.js";
import type { GestureControl } from "../sensors/gesture-switch.js";
import type { SensorSnapshots } from "../sensors/sensor-snapshots.js";
import { loadSkillLibrary } from "../skills/skill-library.js";
import { MacScreen } from "../screen/mac-screen.js";
import { MacHotkey } from "../voice/hotkey.js";
import { HotkeyTalk } from "../voice/hotkey-talk.js";
import { MacVoice } from "../voice/mac-voice.js";
import { RepeatingSpeaker } from "../voice/repeating-speaker.js";
import { createSpeaker } from "../voice/speaker-factory.js";
import { SharedMic } from "../voice/shared-mic.js";
import { playSound } from "../voice/sounds.js";
import { Dictation } from "../voice/dictation.js";
import { Transcriber } from "../voice/transcriber.js";
import type { Adapters } from "./build-app.js";

/**
 * The real world: what main.ts made first (your voice, the page's mic, the assistant's checked agent, the wake word
 * switch and its training, Chrome), the screen, the clipboard, the camera (through the gesture sensor's `snapshots`), pop-ups, your files and the Agent SDK.
 */
export async function realAdapters(
  madeFirst: Pick<
    Adapters,
    "voice" | "mic" | "assistantAgent" | "wakeWord" | "wakeTraining" | "browser" | "chromeLinks"
  >,
  gestures: GestureControl,
  snapshots: SensorSnapshots,
): Promise<Adapters> {
  const screen = await MacScreen.create();
  const devices = {
    ...madeFirst,
    screen,
    clipboard: await MacClipboard.create(),
    camera: SensorCamera.create(snapshots),
    gestures,
    notices: await MacNoticePanel.create(),
  };
  return { ...devices, ...(await popupPanels()), ...filesAndModel() };
}

/** Chrome: project links opened in their profiles, and the web UI, brought up in its Chrome app `uiChromeApp` if set. */
export function chromeAdapters(uiChromeApp?: string): Pick<Adapters, "browser" | "chromeLinks"> {
  return { chromeLinks: new MacChromeLinks(), browser: new MacBrowserPage(uiChromeApp) };
}

type PopupPanels = Pick<Adapters, "popups" | "questionPanels" | "confirmPanels" | "draftPopups" | "chatPanels">;

/** Permission, question, confirm and draft pop-ups, all from one Swift helper, and the chat pop-up from its own. */
async function popupPanels(): Promise<PopupPanels> {
  const popups = await MacPopups.create();
  const questionPanels = await MacQuestionPanels.create(); // after MacPopups: the helper is built by then
  const confirmPanels = await MacConfirmPanels.create();
  const draftPopups = await MacDraftPopups.create();
  const chatPanels = await MacChatPanels.create();
  return { popups, questionPanels, confirmPanels, draftPopups, chatPanels };
}

/** config/destructive.yaml (hot-reloaded), config/config.yaml, config/notes.md, skills/ and the Agent SDK. */
function filesAndModel(): Pick<
  Adapters,
  "destructive" | "configFile" | "notes" | "skills" | "query" | "explainCommands" | "nameSessions"
> {
  const destructive = new DestructiveList();
  destructive.watchForChanges();
  const notes = new AssistantNotes(NOTES_PATH);
  const skills = loadSkillLibrary(SKILLS_DIR);
  return {
    destructive,
    configFile: CONFIG_PATH,
    notes,
    skills,
    query: sdkQuery,
    explainCommands: true,
    nameSessions: true,
  };
}

/** Your voice on macOS, and the one mic the hotkey, gestures, the wake word and the pages' mic buttons share. */
export interface MacVoiceParts {
  voice: MacVoice;
  mic: SharedMic;
}

/** Press the hotkey to start talking and again to send; replies are spoken with Kokoro or `say`, as `voice.engine` says. */
export function macVoice(settings: AppConfig["voice"]): MacVoiceParts {
  const speaker = new RepeatingSpeaker(createSpeaker(settings));
  const dictation = new Dictation(settings, new Transcriber(settings));
  const mic = new SharedMic(dictation, { stopSpeaking: () => speaker.stop(), play: playSound });
  const hotkey = new HotkeyTalk(new MacHotkey(settings.hotkey), mic);
  return { voice: new MacVoice(mic, speaker, hotkey), mic };
}
