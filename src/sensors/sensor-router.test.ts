import { test } from "node:test";
import assert from "node:assert/strict";
import type { Reflex } from "./reflex-table.js";
import type { GestureEvent } from "./sensor-event.js";
import { SensorRouter, type GestureActions } from "./sensor-router.js";

const REFLEXES = new Map<string, Reflex>([
  ["open_palm", { hold: "talk" }],
  ["pointing_up", { tap: ["start_talk"] }],
  ["victory", { tap: ["end_talk"] }],
  ["thumb_down", { tap: ["discard"] }],
  ["closed_fist", { tap: ["stop_speaking"] }],
  ["ok_sign", { tap: ["end_talk", "stop_speaking"] }],
  ["swipe_right", { tap: ["repeat_last"] }],
  ["swipe_left", { tap: ["space_right"] }],
  ["thumb_up", { tap: ["space_left"] }],
]);

/** A router whose actions are written down instead of done. */
function router(): { router: SensorRouter; done: string[] } {
  const done: string[] = [];
  const actions: GestureActions = {
    beginTalk: () => done.push("beginTalk"),
    endTalk: () => done.push("endTalk"),
    discard: () => done.push("discard"),
    stopSpeaking: () => done.push("stopSpeaking"),
    repeatLast: () => done.push("repeatLast"),
    spaceLeft: () => done.push("spaceLeft"),
    spaceRight: () => done.push("spaceRight"),
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

test("sensor router: a swipe repeats the last spoken words", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("swipe_right", "tap"));
  assert.deepEqual(done, ["repeatLast"]);
});

test("sensor router: a swipe can move to the space on the right", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("swipe_left", "tap"));
  assert.deepEqual(done, ["spaceRight"]);
});

test("sensor router: a gesture can move to the space on the left", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("thumb_up", "start"));
  assert.deepEqual(done, ["spaceLeft"]);
});

test("sensor router: a tap gesture with several actions does them all, in order", () => {
  const { router: gestures, done } = router();
  gestures.receive(gesture("ok_sign", "start"));
  assert.deepEqual(done, ["endTalk", "stopSpeaking"]);
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
