import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { timed } from "./timing.js";

function loggedLines(t: TestContext): () => string[] {
  const log = t.mock.method(console, "log", () => {});
  return () => log.mock.calls.map((call) => String(call.arguments[0]));
}

test("timing: a timed step hands back its result", async (t) => {
  loggedLines(t);
  assert.equal(await timed("whisper", async () => "hello"), "hello");
});

test("timing: a timed step logs its name and seconds", async (t) => {
  const lines = loggedLines(t);
  await timed("whisper", async () => "hello");
  assert.match(lines()[0], /^\[timing\] whisper: \d+\.\d s$/);
});

test("timing: a failed step is logged too", async (t) => {
  const lines = loggedLines(t);
  await assert.rejects(timed("whisper", () => Promise.reject(new Error("no model"))));
  assert.equal(lines().length, 1);
});
