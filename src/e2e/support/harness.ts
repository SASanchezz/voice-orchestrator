/**
 * End-to-end flow test with Claude replaced by scripted fakes.
 *
 * Real: config, project discovery, registry, permission broker, destructive rules,
 *       worker manager, orchestrator queueing/notifications/reset, git in real temp repos,
 *       dummy shell commands actually executed in the project folders.
 * Fake: the two LLMs (orchestrator brain + coding workers) and the microphone/speaker.
 */
import { after } from "node:test";
import { rmSync } from "node:fs";
import { TestDraftPopups } from "../../testing/test-draft-popups.js";
import { buildApp, startOperator } from "../../app/build-app.js";
import { loadAssistantAgent } from "../../config/assistant-agent.js";
import { ASSISTANT_AGENT_PATH, SKILLS_DIR } from "../../config/paths.js";
import { AssistantNotes } from "../../orchestrator/memory/assistant-notes.js";
import { DestructiveList } from "../../safety/destructive-list.js";
import { UnavailableGestures } from "../../sensors/gesture-switch.js";
import { UnavailableWakeWord } from "../../wake/wake-switch.js";
import { UnavailableWakeTraining } from "../../wake/wake-training.js";
import { loadSkillLibrary } from "../../skills/skill-library.js";
import { UnavailableDictation } from "../../voice/dictation.js";
import { SharedMic } from "../../voice/shared-mic.js";
import { fakeQuery } from "../../testing/fake-query.js";
import { TestClipboard } from "../../testing/test-clipboard.js";
import { TestBrowserPage, TestNoticePanel } from "../../testing/test-notices.js";
import { TestChromeLinks } from "../../testing/test-chrome-links.js";
import { TestPopups } from "../../testing/test-popups.js";
import { TestChatPanels } from "../../testing/test-chat-panels.js";
import { TestConfirmPanels, TestQuestionPanels } from "../../testing/test-panels.js";
import { connectBrain, fakeOperator } from "./fake-operator.js";
import { fakeWorker } from "./fake-worker.js";
import { cfg, configFile, notesFile, root, rulesFile } from "./sandbox.js";
import { TestCamera, TestScreen, TestVoice } from "./test-devices.js";

after(() => rmSync(root, { recursive: true, force: true }));

export const voice = new TestVoice();
export const screen = new TestScreen();
export const popups = new TestPopups();
export const questionPanels = new TestQuestionPanels();
export const confirmPanels = new TestConfirmPanels();
export const draftPopups = new TestDraftPopups();
export const chatPanels = new TestChatPanels();
export const notices = new TestNoticePanel();

const query = fakeQuery(({ prompt, options }) =>
  typeof prompt === "string" ? fakeWorker(prompt, options!) : fakeOperator(prompt, options!),
);

export const app = buildApp(cfg, {
  voice,
  screen,
  clipboard: new TestClipboard(),
  camera: new TestCamera(),
  notes: new AssistantNotes(notesFile),
  assistantAgent: loadAssistantAgent(ASSISTANT_AGENT_PATH),
  skills: loadSkillLibrary(SKILLS_DIR),
  configFile,
  destructive: new DestructiveList(rulesFile),
  query,
  gestures: new UnavailableGestures(),
  wakeWord: new UnavailableWakeWord(),
  wakeTraining: new UnavailableWakeTraining("There is no mic in tests."),
  mic: new SharedMic(new UnavailableDictation(), { stopSpeaking: () => {}, play: () => {} }),
  explainCommands: false,
  reviewCommands: false,
  nameSessions: false,
  popups,
  questionPanels,
  confirmPanels,
  draftPopups,
  chatPanels,
  notices,
  browser: new TestBrowserPage(),
  chromeLinks: new TestChromeLinks(),
});
connectBrain(app.operator.tools);
await startOperator(app, voice);

export const uiUrl = new URL(await app.ui.server.start(cfg.ui.port));
export const uiToken = uiUrl.searchParams.get("token")!;
after(() => app.ui.server.stop());
