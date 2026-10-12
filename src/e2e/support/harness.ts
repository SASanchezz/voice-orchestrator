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
import { buildApp, startOperator } from "../../app/build-app.js";
import { AssistantNotes } from "../../orchestrator/memory/assistant-notes.js";
import { DestructiveList } from "../../safety/destructive-list.js";
import { fakeQuery } from "../../testing/fake-query.js";
import { TestBrowserPage, TestNotices } from "../../testing/test-notices.js";
import { TestPopups } from "../../testing/test-popups.js";
import { connectBrain, fakeOperator } from "./fake-operator.js";
import { fakeWorker } from "./fake-worker.js";
import { cfg, notesFile, root, rulesFile } from "./sandbox.js";
import { TestScreen, TestVoice } from "./test-devices.js";

after(() => rmSync(root, { recursive: true, force: true }));

export const voice = new TestVoice();
export const screen = new TestScreen();
export const popups = new TestPopups();

const query = fakeQuery(({ prompt, options }) =>
  typeof prompt === "string" ? fakeWorker(prompt, options!) : fakeOperator(prompt, options!),
);

export const app = buildApp(cfg, {
  voice,
  screen,
  notes: new AssistantNotes(notesFile),
  destructive: new DestructiveList(rulesFile),
  query,
  explainCommands: false,
  popups,
  notices: new TestNotices(),
  browser: new TestBrowserPage(),
});
connectBrain(app.operator.tools);
await startOperator(app, voice);

export const uiUrl = new URL(await app.ui.server.start(cfg.ui.port));
export const uiToken = uiUrl.searchParams.get("token")!;
after(() => app.ui.server.stop());
