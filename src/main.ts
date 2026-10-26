import { spawn } from "node:child_process";
import { buildApp, startOperator, type App } from "./app/build-app.js";
import { buildGestures, gestureActions, gestureSetting } from "./app/build-gestures.js";
import { checkLogins } from "./app/login-check.js";
import { macVoice, realAdapters } from "./app/real-adapters.js";
import { RESTART_EXIT_CODE, RESTARTED_ENV } from "./app/restart.js";
import type { AppConfig } from "./config/app-config.js";
import { MacSpaces } from "./macos/mac-spaces.js";
import { loadConfig } from "./config/load-config.js";
import { GestureSwitch, UnavailableGestures } from "./sensors/gesture-switch.js";
import { SensorSnapshots } from "./sensors/sensor-snapshots.js";
import { errorMessage } from "./shared/errors.js";
import { TextVoice } from "./voice/text-voice.js";

/** Time for workers to stop before the process exits. */
const WORKER_STOP_GRACE_MS = 300;

const cfg = loadConfig();
const textMode = process.argv.includes("--text");

if (!process.argv.includes("--skip-auth-check")) await checkLogins(cfg);

const mac = textMode ? undefined : macVoice(cfg.voice);
const voice = mac?.voice ?? new TextVoice();
const gestures = mac ? new GestureSwitch(gestureSetting(cfg.sensors.gestures)) : undefined; // text mode has no mic
const snapshots = new SensorSnapshots(); // the camera's frames come from the gesture sensor while it runs
const app = buildApp(cfg, await realAdapters(voice, gestures ?? new UnavailableGestures(), snapshots));

await openUi(cfg, app);

startOperator(app, voice)
  .then(connectGestures) // once the mic is ready
  .catch((e: unknown) => {
    console.error(errorMessage(e));
    process.exit(1);
  });

process.on("SIGINT", () => shutDown(0));
app.operator.lifecycle.on("restart", () => {
  console.log("Restarting…");
  shutDown(RESTART_EXIT_CODE);
});

/** The camera is used only while the web UI's Gestures switch is on. */
function connectGestures(): void {
  if (!mac || !gestures) return;
  const actions = gestureActions(mac, app.operator, new MacSpaces());
  gestures.connect(() => buildGestures(cfg.sensors.gestures, actions, snapshots));
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
  app.workers.control.stopAll();
  app.ui.server.stop();
  setTimeout(() => process.exit(exitCode), WORKER_STOP_GRACE_MS);
}
