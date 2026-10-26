import { test } from "node:test";
import assert from "node:assert/strict";
import { MacSpaces } from "./mac-spaces.js";

/** Spaces whose scripts are written down instead of run. */
function spaces(): { spaces: MacSpaces; scripts: string[] } {
  const scripts: string[] = [];
  const record = (script: string): Promise<void> => {
    scripts.push(script);
    return Promise.resolve();
  };
  return { spaces: new MacSpaces(record), scripts };
}

test("mac spaces: moving left presses Ctrl+Left", async () => {
  const { spaces: desktop, scripts } = spaces();
  await desktop.moveLeft();
  assert.deepEqual(scripts, ['tell application "System Events" to key code 123 using control down']);
});

test("mac spaces: moving right presses Ctrl+Right", async () => {
  const { spaces: desktop, scripts } = spaces();
  await desktop.moveRight();
  assert.deepEqual(scripts, ['tell application "System Events" to key code 124 using control down']);
});

test("mac spaces: a failing script doesn't throw", async () => {
  const desktop = new MacSpaces(() => Promise.reject(new Error("not allowed to send keystrokes")));
  await assert.doesNotReject(desktop.moveLeft());
});
