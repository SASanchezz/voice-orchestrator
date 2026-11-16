import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RestartBackoff } from "../sensors/restarting-process.js";
import { sleep } from "../shared/sleep.js";
import { WakeProcess } from "./wake-process.js";
import type { WakeListener } from "./wake-talk.js";

const RESTART_DELAY_MS = 10;
const WAIT_STEP_MS = 20;
const WAIT_MAX_MS = 5000;

const READY = '{"type":"ready","model":"oracle"}';
const WAKE = '{"type":"wake","score":0.9}';
const SPEECH_END = '{"type":"speech_end"}';
const NO_SPEECH = '{"type":"no_speech"}';
const STOP_WORD = '{"type":"stop_word"}';
const STAY_RUNNING = "setInterval(() => {}, 1000);";

class RecordingListener implements WakeListener {
  heardEvents: string[] = [];

  listening(model: string): void {
    this.heardEvents.push(`listening ${model}`);
  }

  heard(score: number): void {
    this.heardEvents.push(`wake ${score}`);
  }

  sensorStopped(): void {
    this.heardEvents.push("stopped");
  }
}

const quickBackoff: RestartBackoff = { nextDelay: () => RESTART_DELAY_MS, reset: () => {} };

/** A listener process that is a Node script printing `lines`, then running `then`. */
function fakeListener(lines: string[], then: string): { wake: WakeProcess; heard: RecordingListener } {
  const script = join(mkdtempSync(join(tmpdir(), "vo-wake-")), "listener.mjs");
  const prints = lines.map((line) => `console.log(${JSON.stringify(line)});`).join("\n");
  writeFileSync(script, `${prints}\n${then}\n`);
  const heard = new RecordingListener();
  return { wake: new WakeProcess({ bin: process.execPath, args: [script] }, heard, quickBackoff), heard };
}

async function until(done: () => boolean): Promise<void> {
  const end = Date.now() + WAIT_MAX_MS;
  while (!done() && Date.now() < end) await sleep(WAIT_STEP_MS);
}

test("wake process: ready and a wake reach the listener in order", async () => {
  const { wake, heard } = fakeListener([READY, WAKE], STAY_RUNNING);
  wake.start();
  await until(() => heard.heardEvents.length === 2);
  wake.stop();
  assert.deepEqual(heard.heardEvents.slice(0, 2), ["listening oracle", "wake 0.9"]);
});

test("wake process: a pause, nothing said or the wake word said again don't end the message", async () => {
  const { wake, heard } = fakeListener([WAKE, SPEECH_END, NO_SPEECH, STOP_WORD, READY], STAY_RUNNING);
  wake.start();
  await until(() => heard.heardEvents.length === 2);
  wake.stop();
  assert.deepEqual(heard.heardEvents.slice(0, 2), ["wake 0.9", "listening oracle"]);
});

test("wake process: a line it can't read is skipped", async () => {
  const { wake, heard } = fakeListener(["not json", WAKE], STAY_RUNNING);
  wake.start();
  await until(() => heard.heardEvents.length === 1);
  wake.stop();
  assert.deepEqual(heard.heardEvents.slice(0, 1), ["wake 0.9"]);
});

test("wake process: a listener that exits is reported as stopped", async () => {
  const { wake, heard } = fakeListener([READY], "process.exit(2);");
  wake.start();
  await until(() => heard.heardEvents.includes("stopped"));
  wake.stop();
  assert.ok(heard.heardEvents.includes("stopped"));
});
