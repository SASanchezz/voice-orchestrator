import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { testConfig } from "../testing/test-config.js";
import { PushToTalk } from "./push-to-talk.js";
import { Transcriber } from "./transcriber.js";

/** Past the 400 ms that counts as an accidental tap, so the recording is transcribed. */
const TEST_LIMIT_MS = 600;
/** Held long enough to be transcribed, released before the limit. */
const HELD_PAST_TAP_MS = 450;
const TRANSCRIPT = "a long message that went on past the limit";
const WAIT_STEP_MS = 20;
const WAIT_MAX_MS = 5000;

/** Stands in for sox: creates the WAV file it is given, then records nothing until it is stopped. */
const FAKE_RECORDER = '#!/bin/sh\ntouch "$8"\ntrap "exit 0" INT\nwhile true; do sleep 0.05; done\n';

class FixedTranscriber extends Transcriber {
  override transcribeOrNothing(): Promise<string> {
    return Promise.resolve(TRANSCRIPT);
  }
}

/** A push-to-talk on a fake recorder, with the start and end sounds silenced; it collects what it sends. */
function pushToTalk(): { ptt: PushToTalk; sent: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "vo-ptt-"));
  setStateDir(dir);
  const recordBin = executable(dir, "rec", FAKE_RECORDER);
  executable(dir, "afplay", "#!/bin/sh\nexit 0\n");
  process.env.PATH = `${dir}:${process.env.PATH ?? ""}`;
  const voice = { ...testConfig({}).voice, recordBin, mergeWindowSeconds: 0.01 };
  const ptt = new PushToTalk(voice, new FixedTranscriber(voice), TEST_LIMIT_MS);
  const sent: string[] = [];
  ptt.onMessage((message) => sent.push(message));
  return { ptt, sent };
}

function executable(dir: string, name: string, script: string): string {
  const path = join(dir, name);
  writeFileSync(path, script);
  chmodSync(path, 0o755);
  return path;
}

async function until(done: () => boolean): Promise<void> {
  const end = Date.now() + WAIT_MAX_MS;
  while (!done() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
}

test("push to talk: a recording that reaches the limit is transcribed and sent", async () => {
  const { ptt, sent } = pushToTalk();
  ptt.begin();
  await until(() => sent.length > 0);
  assert.deepEqual(sent, [TRANSCRIPT]);
});

test("push to talk: releasing the key after the limit sends nothing a second time", async () => {
  const { ptt, sent } = pushToTalk();
  ptt.begin();
  await until(() => sent.length > 0);
  ptt.release();
  await new Promise((resolve) => setTimeout(resolve, TEST_LIMIT_MS));
  assert.deepEqual(sent, [TRANSCRIPT]);
});

test("push to talk: the mic is off and nothing is held once the limit's message is sent", async () => {
  const { ptt, sent } = pushToTalk();
  ptt.begin();
  await until(() => sent.length > 0);
  assert.equal(ptt.state(), "idle");
});

test("push to talk: a recording discarded while you talk is never sent", async () => {
  const { ptt, sent } = pushToTalk();
  ptt.begin();
  ptt.discard();
  await new Promise((resolve) => setTimeout(resolve, TEST_LIMIT_MS * 2));
  assert.deepEqual(sent, []);
});

test("push to talk: a message discarded after the key's release, while it is transcribed, is never sent", async () => {
  const { ptt, sent } = pushToTalk();
  ptt.begin();
  await new Promise((resolve) => setTimeout(resolve, HELD_PAST_TAP_MS));
  ptt.release();
  ptt.discard();
  await new Promise((resolve) => setTimeout(resolve, TEST_LIMIT_MS));
  assert.deepEqual(sent, []);
});

test("push to talk: the mic is off and nothing is held once the message is discarded", () => {
  const { ptt } = pushToTalk();
  ptt.begin();
  ptt.discard();
  assert.equal(ptt.state(), "idle");
});
