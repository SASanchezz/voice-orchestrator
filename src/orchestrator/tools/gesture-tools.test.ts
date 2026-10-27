import { test } from "node:test";
import assert from "node:assert/strict";
import type { GestureMode } from "../../sensors/gesture-setting.js";
import { UnavailableGestures, type GestureControl, type GestureState } from "../../sensors/gesture-switch.js";
import { setGestures } from "./gesture-tools.js";
import type { ToolResult } from "./tool-kit.js";

/** Stands in for the Gestures switch; it remembers what it was switched to. */
class FakeGestures implements GestureControl {
  state: GestureState = "off";

  setMode(mode: GestureMode): string {
    this.state = mode;
    return `Gestures ${mode}.`;
  }
}

function textOf(result: ToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

test("set_gestures: turning gestures on switches them on", async () => {
  const gestures = new FakeGestures();
  await setGestures(gestures).call({ mode: "on" });
  assert.equal(gestures.state, "on");
});

test("set_gestures: turning gestures off switches them off", async () => {
  const gestures = new FakeGestures();
  gestures.state = "on";
  await setGestures(gestures).call({ mode: "off" });
  assert.equal(gestures.state, "off");
});

test("set_gestures: the model reads the switch's answer, to say it back", async () => {
  const result = await setGestures(new FakeGestures()).call({ mode: "on" });
  assert.equal(textOf(result), "Gestures on.");
});

test("set_gestures: without a mic (text mode), the model reads why it can't", async () => {
  const result = await setGestures(new UnavailableGestures()).call({ mode: "on" });
  assert.match(textOf(result), /^Error: .*text mode/);
});

test("set_gestures: only on and off are accepted", async () => {
  const gestures = new FakeGestures();
  await setGestures(gestures).call({ mode: "maybe" });
  assert.equal(gestures.state, "off");
});
