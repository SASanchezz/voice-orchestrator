import { spawn } from "node:child_process";
import { requireAssistantAgent } from "./app/assistant-agent-check.js";
import { buildApp, startOperator, type App } from "./app/build-app.js";
import { buildGestures, gestureActions, gestureSetting } from "./app/build-gestures.js";
import { buildMessageAlerts } from "./app/build-message-alerts.js";
import { buildWakeTraining, buildWakeWord, isWakeWordSetUp, wakeWordSetting } from "./app/build-wake-word.js";
import { checkLogins } from "./app/login-check.js";
import { chromeAdapters, macVoice, realAdapters } from "./app/real-adapters.js";
import { RESTART_EXIT_CODE, RESTARTED_ENV } from "./app/restart.js";
import type { AppConfig } from "./config/app-config.js";
import { MacSpaces } from "./macos/mac-spaces.js";
import { loadConfig } from "./config/load-config.js";
import { GestureSwitch, UnavailableGestures } from "./sensors/gesture-switch.js";
import { SensorSnapshots } from "./sensors/sensor-snapshots.js";
import { errorMessage } from "./shared/errors.js";
import { UnavailableDictation } from "./voice/dictation.js";
import { SharedMic } from "./voice/shared-mic.js";
import { TextVoice } from "./voice/text-voice.js";
import { UnavailableWakeWord, WakeSwitch } from "./wake/wake-switch.js";
import { TrainingNews } from "./wake/training-news.js";
import { UnavailableWakeTraining } from "./wake/wake-training.js";

/** Time for workers to stop before the process exits. */
const WORKER_STOP_GRACE_MS = 300;

const assistantAgent = requireAssistantAgent(); // strict: nothing starts without it
const cfg = loadConfig();
const textMode = process.argv.includes("--text");

if (!process.argv.includes("--skip-auth-check")) await checkLogins(cfg);

const mac = textMode ? undefined : macVoice(cfg.voice);
const voice = mac?.voice ?? new TextVoice();
const mic = mac?.mic ?? new SharedMic(new UnavailableDictation(), { stopSpeaking: () => {}, play: () => {} }); // text mode has no mic
const gestures = mac ? new GestureSwitch(gestureSetting(cfg.sensors.gestures)) : undefined; // text mode has no mic
const wakeWord = mac ? new WakeSwitch(wakeWordSetting()) : undefined;
const trainingNews = new TrainingNews();
const wakeTraining = wakeWord
  ? buildWakeTraining(cfg, wakeWord, trainingNews)
  : new UnavailableWakeTraining("Wake word training needs the mic, and text mode has none.");
const snapshots = new SensorSnapshots(); // the camera's frames come from the gesture sensor while it runs
const app = buildApp(
  cfg,
  await realAdapters(
    {
      voice,
      mic,
      assistantAgent,
      wakeWord: wakeWord ?? new UnavailableWakeWord(),
      wakeTraining,
      ...chromeAdapters(cfg.ui.chromeApp),
    },
    gestures ?? new UnavailableGestures(),
    snapshots,
  ),
);

trainingNews.connect(app.operator.orchestrator);
// "allow commit" and "confirm send" need no "finish"
mac?.voice.endRecordingWhen((words) => app.permissions.spoken.canAnswer(words) || app.replies.spoken.canAnswer(words));
mac?.voice.handOffTo(app.ui.boxes.relay);
await openUi(cfg, app);
app.editor.server.start(); // once the UI has made the token file it reads
if (cfg.limits.autoResume) app.workers.resumer.start();
const messageAlerts = buildMessageAlerts(cfg.messages, app.core.messengers, app.operator.orchestrator);

startOperator(app, voice)
  .then(connectGestures) // once the mic is ready
  .then(connectWakeWord)
  .then(startMessengers)
  .catch((e: unknown) => {
    console.error(errorMessage(e));
    process.exit(1);
  });

process.on("SIGINT", () => {
  app.editor.server.stop();
  shutDown(0);
});
app.operator.lifecycle.on("restart", () => {
  console.log("Restarting…");
  app.editor.server.keepRunning(); // the Code view's terminals, and the servers running in them, outlive the restart
  shutDown(RESTART_EXIT_CODE);
});

function startMessengers(): void {
  messageAlerts.start();
  app.replies.feeds.start();
}

/** The camera is used only while the web UI's Gestures switch is on. */
function connectGestures(): void {
  if (!mac || !gestures) return;
  const actions = gestureActions(mac, app.operator, new MacSpaces());
  gestures.connect(() => buildGestures(cfg.sensors.gestures, actions, snapshots));
}

/** The mic stays open between your messages while the web UI's Wake word switch is on (and sensors/wake is set up). */
function connectWakeWord(): void {
  if (!mac || !wakeWord) return;
  const settings = cfg.sensors.wakeWord;
  if (!isWakeWordSetUp(settings)) {
    console.log(`[wake word] off: ${settings.python} not found; set up sensors/wake as its README says.`);
    return;
  }
  wakeWord.connect(() => buildWakeWord(settings, cfg.voice.recordBin, mac));
}

async function openUi({ ui }: AppConfig, { ui: parts }: App): Promise<void> {
  try {
    const url = await parts.server.start(ui.port);
    console.log(`UI: ${url}`);
    if (ui.open && !process.env[RESTARTED_ENV]) spawn("open", [url], { stdio: "ignore" });
  } catch (e) {
    console.error(`[ui] not started: ${errorMessage(e)} (set ui.port in config/config.yaml)`);
  }
}

function shutDown(exitCode: number): void {
  gestures?.stop();
  wakeWord?.stop();
  app.workers.control.stopAll();
  app.ui.server.stop();
  setTimeout(() => process.exit(exitCode), WORKER_STOP_GRACE_MS);
}
