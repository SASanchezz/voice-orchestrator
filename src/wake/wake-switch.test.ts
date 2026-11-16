import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WakeWordSetting } from "./wake-setting.js";
import { UnavailableWakeWord, WakeSwitch, type WakeListenerProcess } from "./wake-switch.js";

/** Stands in for the wake listener; it writes down whether it was started and stopped. */
class FakeListener implements WakeListenerProcess {
  constructor(private done: string[]) {}

  start(): void {
    this.done.push("start");
  }

  stop(): void {
    this.done.push("stop");
  }
}

function settingFile(): string {
  return join(mkdtempSync(join(tmpdir(), "vo-wake-switch-")), "wake-word.json");
}

/** A switch with a fake listener, connected as it is once the mic is ready. */
function connectedSwitch(file = settingFile()): { wakeWord: WakeSwitch; done: string[] } {
  const done: string[] = [];
  const wakeWord = new WakeSwitch(new WakeWordSetting(file));
  wakeWord.connect(() => new FakeListener(done));
  return { wakeWord, done };
}

test("wake switch: never switched, it is on and the listener starts once the mic is ready", () => {
  assert.deepEqual(connectedSwitch().done, ["start"]);
});

test("wake switch: switching off stops the listener", () => {
  const { wakeWord, done } = connectedSwitch();
  wakeWord.setMode("off");
  assert.deepEqual(done, ["start", "stop"]);
});

test("wake switch: switched off, it stays off after a restart", () => {
  const file = settingFile();
  connectedSwitch(file).wakeWord.setMode("off");
  assert.deepEqual(connectedSwitch(file).done, []);
});

test("wake switch: switching on again starts the listener once", () => {
  const { wakeWord, done } = connectedSwitch();
  wakeWord.setMode("on");
  assert.deepEqual(done, ["start"]);
});

test("wake switch: switching off says the mic is used only while you talk", () => {
  assert.equal(connectedSwitch().wakeWord.setMode("off"), "Wake word off: the mic is used only while you talk.");
});

test("wake switch: a setting file it can't read is an error, not a guess", () => {
  const file = settingFile();
  writeFileSync(file, '{"mode":"maybe"}');
  assert.throws(() => new WakeWordSetting(file).read());
});

test("wake switch: text mode has no wake word", () => {
  assert.throws(() => new UnavailableWakeWord().setMode("on"), /text mode/);
});

test("wake switch: the listener is stopped while paused work runs, then started again", async () => {
  const { wakeWord, done } = connectedSwitch();
  await wakeWord.pausedDuring(() => Promise.resolve(done.push("work")));
  assert.deepEqual(done, ["start", "stop", "work", "start"]);
});

test("wake switch: switched off, paused work doesn't start the listener afterwards", async () => {
  const { wakeWord, done } = connectedSwitch();
  wakeWord.setMode("off");
  await wakeWord.pausedDuring(() => Promise.resolve());
  assert.deepEqual(done, ["start", "stop"]);
});

test("wake switch: paused work that fails still starts the listener again", async () => {
  const { wakeWord, done } = connectedSwitch();
  await assert.rejects(wakeWord.pausedDuring(() => Promise.reject(new Error("no mic"))));
  assert.deepEqual(done, ["start", "stop", "start"]);
});
