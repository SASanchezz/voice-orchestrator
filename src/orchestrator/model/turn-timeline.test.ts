import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { TurnTimeline, type AssistantContent } from "./turn-timeline.js";

function loggedLines(t: TestContext): () => string[] {
  const log = t.mock.method(console, "log", () => {});
  return () => log.mock.calls.map((call) => String(call.arguments[0]));
}

const toolUse = (name: string): AssistantContent => [{ type: "tool_use", id: "t1", name, input: {} }];
const words = (text: string): AssistantContent => [{ type: "text", text, citations: null }];

function timeline(): TurnTimeline {
  const turn = new TurnTimeline();
  turn.turnStarted();
  return turn;
}

test("turn timeline: each tool the model asks for is logged", (t) => {
  const lines = loggedLines(t);
  timeline().modelWrote(toolUse("mcp__ctl__look_at_camera"));
  assert.match(lines()[0], /model asked for mcp__ctl__look_at_camera: \d+\.\d s/);
});

test("turn timeline: only the model's first words are logged", (t) => {
  const lines = loggedLines(t);
  const turn = timeline();
  turn.modelWrote(words("Let me look."));
  turn.modelWrote(words("It's a red mug."));
  assert.equal(lines().length, 1);
});

test("turn timeline: a new turn logs its first words again", (t) => {
  const lines = loggedLines(t);
  const turn = timeline();
  turn.modelWrote(words("Done."));
  turn.turnStarted();
  turn.modelWrote(words("Sure."));
  assert.equal(lines().length, 2);
});

test("turn timeline: the turn's end says how many model calls it took", (t) => {
  const lines = loggedLines(t);
  timeline().turnEnded(2);
  assert.match(lines()[0], /turn done after 2 model calls/);
});
