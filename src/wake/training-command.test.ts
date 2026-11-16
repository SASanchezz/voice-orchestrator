import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrainingCommand } from "./training-command.js";

const SAMPLES = '{"type":"samples","wake":3,"other":1,"trained":false}';
const TRIED = '{"type":"tried","score":0.9,"threshold":0.5}';
const FAILED = '{"type":"error","message":"No wake word model."}';
const PRINT_ARGS = "console.log(JSON.stringify({type:'error',message:process.argv.slice(2).join(' ')}));";

/** `python -m wake` stood in for by a Node script, which prints `lines` and exits with `exitCode`. */
function fakeTraining(lines: string[], exitCode = 0): TrainingCommand {
  const script = join(mkdtempSync(join(tmpdir(), "vo-wake-training-")), "wake.mjs");
  const prints = lines.map((line) => `console.log(${JSON.stringify(line)});`).join("\n");
  writeFileSync(script, `${prints}\nprocess.exit(${exitCode});\n`);
  return new TrainingCommand({ bin: process.execPath, args: [script] }, "rec");
}

test("training command: its result line is what it answers", async () => {
  assert.deepEqual(await fakeTraining(["progress, not JSON", SAMPLES]).samples(), JSON.parse(SAMPLES));
});

test("training command: its reported error is thrown with the reason", async () => {
  await assert.rejects(fakeTraining([FAILED], 2).tryOut(), /^Error: No wake word model\.$/);
});

test("training command: a result of the wrong kind is refused", async () => {
  await assert.rejects(fakeTraining([TRIED]).train(), /answered "tried"/);
});

test("training command: no result at all says it stopped", async () => {
  await assert.rejects(fakeTraining([], 1).samples(), /stopped \(exit code 1\) with no result/);
});

test("training command: a recording is made with the label and the configured recorder", async () => {
  const script = join(mkdtempSync(join(tmpdir(), "vo-wake-training-")), "wake.mjs");
  writeFileSync(script, PRINT_ARGS);
  const command = new TrainingCommand({ bin: process.execPath, args: [script] }, "/opt/sox/rec");
  await assert.rejects(command.record("other"), /^Error: record --label other --record-bin \/opt\/sox\/rec$/);
});
