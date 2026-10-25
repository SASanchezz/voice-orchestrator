import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GestureSetting } from "./gesture-setting.js";

function settingFile(): string {
  return join(mkdtempSync(join(tmpdir(), "vo-gesture-setting-")), "gestures.json");
}

test("gesture setting: never switched, it is what config.yaml says", () => {
  assert.equal(new GestureSetting(settingFile(), "on").read(), "on");
});

test("gesture setting: the last switch is read back", () => {
  const file = settingFile();
  new GestureSetting(file, "on").remember("off");
  assert.equal(new GestureSetting(file, "on").read(), "off");
});

test("gesture setting: a file it can't read is an error, not a guess", () => {
  const file = settingFile();
  writeFileSync(file, '{"mode":"maybe"}');
  assert.throws(() => new GestureSetting(file, "on").read());
});
