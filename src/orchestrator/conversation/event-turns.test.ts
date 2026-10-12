import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { EventTurns, REPLY_WAIT_MS } from "./event-turns.js";
import type { EventInput } from "./inputs.js";
import type { Turn } from "./turn-taker.js";

const ANNOUNCEMENT = "kaggle session 1 done: retrain the model";
const TASK_DONE: EventInput = {
  kind: "event",
  text: "[EVENT] kaggle finished its task.",
  urgent: false,
  announcement: ANNOUNCEMENT,
};

/** What the fake model does with its turn: speak a reply, stay on screen, or fail. */
type ModelReply = (turn: Turn, say: (text: string) => void) => Promise<string>;

const speaks =
  (text: string): ModelReply =>
  async (turn, say) => {
    if (turn.voice?.replyMaySpeak() ?? true) say(text);
    return text;
  };
const screenOnly: ModelReply = async () => "[SCREEN]\nkaggle finished.";
const notYet = (): void => {};
const fails: ModelReply = async () => {
  throw new Error("model crashed");
};

/** Event turns with a fake model and speaker; `spoken` is everything said aloud, in order. */
function eventTurns(reply: ModelReply, aloud = true) {
  const spoken: string[] = [];
  const say = (text: string) => void spoken.push(text);
  const turns = { take: (turn: Turn) => reply(turn, say) };
  const gate = { isAlreadyAnswered: () => false, askedAbout: () => {} };
  const speech = { speaksAbout: () => aloud, speakWhenQuiet: async (text: string) => say(text) };
  return { events: new EventTurns(turns, gate, speech), spoken };
}

test("event turns: a finished task is spoken once, by the model's reply", async () => {
  const { events, spoken } = eventTurns(speaks("kaggle session 1 finished: model retrained."));
  await events.handle(TASK_DONE);
  assert.deepEqual(spoken, ["kaggle session 1 finished: model retrained."]);
});

test("event turns: a reply with nothing to say aloud falls back to the announcement", async () => {
  const { events, spoken } = eventTurns(screenOnly);
  await events.handle(TASK_DONE);
  assert.deepEqual(spoken, [ANNOUNCEMENT]);
});

test("event turns: a failed model turn still says the announcement", async () => {
  const { events, spoken } = eventTurns(fails);
  await assert.rejects(events.handle(TASK_DONE), /model crashed/);
  assert.deepEqual(spoken, [ANNOUNCEMENT]);
});

test("event turns: a slow reply is preceded by the announcement and then stays quiet", async (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finishReply = notYet;
  const slow: ModelReply = (turn, say) =>
    new Promise((done) => {
      finishReply = () => done(speaks("late reply")(turn, say));
    });
  const { events, spoken } = eventTurns(slow);
  const handled = events.handle(TASK_DONE);
  t.mock.timers.tick(REPLY_WAIT_MS);
  finishReply();
  await handled;
  assert.deepEqual(spoken, [ANNOUNCEMENT]);
});

test("event turns: in muted mode nothing is said, not even the announcement", async () => {
  const { events, spoken } = eventTurns(screenOnly, false);
  await events.handle(TASK_DONE);
  assert.deepEqual(spoken, []);
});

test("event turns: a permission request has no announcement to fall back to", async () => {
  const permission: EventInput = {
    kind: "event",
    text: "[PERMISSION p1] kaggle wants…",
    urgent: true,
    permissionId: "p1",
  };
  const { events, spoken } = eventTurns(screenOnly);
  await events.handle(permission);
  assert.deepEqual(spoken, []);
});
