import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { readPanelOutput } from "./panel-output.js";

/** A pop-up's output as the orchestrator reads it; records its clicks and answers in order. */
function readOutput(printed: string) {
  const output = new PassThrough();
  const heard: string[] = [];
  readPanelOutput(
    output,
    () => void heard.push("seen"),
    (answer) => void heard.push(answer),
  );
  output.end(printed);
  return new Promise<string[]>((resolve) => output.on("end", () => setImmediate(() => resolve(heard))));
}

test("panel output: the first click comes before the answer", async () => {
  assert.deepEqual(await readOutput("seen\nallow\n"), ["seen", "allow"]);
});

test("panel output: an answer without a click first is still passed on", async () => {
  assert.deepEqual(await readOutput("deny\n"), ["deny"]);
});

test("panel output: nothing after the answer is passed on", async () => {
  assert.deepEqual(await readOutput("option:1\nseen\nallow\n"), ["option:1"]);
});
