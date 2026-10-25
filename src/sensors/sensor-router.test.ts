import { test } from "node:test";
import assert from "node:assert/strict";
import type { Reflex } from "./reflex-table.js";
import type { GestureEvent } from "./sensor-event.js";
import { SensorRouter, type GestureActions } from "./sensor-router.js";

const REFLEXES = new Map<string, Reflex>([
  ["open_palm", { hold: "talk" }],
  ["pointing_up", { tap: "start_talk" }],
  ["victory", { tap: "end_talk" }],
  ["thumb_down", { tap: "discard" }],
  ["closed_fist", { tap: "stop_speaking" }],
]);

/** A router whose actions are written down instead of done. */
function router(): { router: SensorRouter; done: string[] } {
  const done: string[] = [];
  const actions: GestureActions = {
    beginTalk: () => done.push("beginTalk"),
    endTalk: () => done.push("endTalk"),
    discard: () => done.push("discard"),
    stopSpeaking: () => done.push("stopSpeaking"),
  };
  return { router: new SensorRouter(REFLEXES, actions), done };
}

function gesture(name: string, phase: GestureEvent["phase"], hand = "right"): GestureEvent {
  return { type: "gesture", phase, name, hand, ts: 0 };
}

test("sensor router: holding the talk gesture talks until it is lowered", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("open_palm", "start"));
  gestures.receive(gesture("open_palm", "end"));
  assert.deepEqual(done, ["beginTalk", "endTalk"]);
});

test("sensor router: the other hand's talk gesture is ignored while one hand talks", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("open_palm", "start", "right"));
  gestures.receive(gesture("open_palm", "start", "left"));
  gestures.receive(gesture("open_palm", "end", "left"));
  assert.deepEqual(done, ["beginTalk"]);
});

test("sensor router: a tap gesture acts once, when it starts", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("thumb_down", "start"));
  gestures.receive(gesture("thumb_down", "end"));
  assert.deepEqual(done, ["discard"]);
});

test("sensor router: a closed fist stops the reply being spoken", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("closed_fist", "start"));
  assert.deepEqual(done, ["stopSpeaking"]);
});

test("sensor router: talk started by one tap gesture is ended by another", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("pointing_up", "start"));
  gestures.receive(gesture("pointing_up", "end"));
  gestures.receive(gesture("victory", "start"));
  assert.deepEqual(done, ["beginTalk", "endTalk"]);
});

test("sensor router: a gesture with no reflex does nothing", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("i_love_you", "start"));
  assert.deepEqual(done, []);
});

test("sensor router: the sensor stopping mid-talk ends the talk", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("open_palm", "start"));
  gestures.sensorStopped();
  assert.deepEqual(done, ["beginTalk", "endTalk"]);
});

test("sensor router: the sensor stopping ends a talk started by a tap", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("pointing_up", "start"));
  gestures.sensorStopped();
  assert.deepEqual(done, ["beginTalk", "endTalk"]);
});
