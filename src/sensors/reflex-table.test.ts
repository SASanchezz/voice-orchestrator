import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { APP_DIR } from "../config/paths.js";
import { loadReflexTable } from "./reflex-table.js";

function mappingFile(yaml: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "vo-reflexes-")), "gestures.yaml");
  writeFileSync(path, yaml);
  return path;
}

test("reflex table: the example file starts talking on an open palm", () => {
  const reflexes = loadReflexTable(resolve(APP_DIR, "config/gestures.example.yaml"));
  assert.deepEqual(reflexes.get("open_palm"), { tap: "start_talk" });
});

test("reflex table: the example file ends talking on a closed fist", () => {
  const reflexes = loadReflexTable(resolve(APP_DIR, "config/gestures.example.yaml"));
  assert.deepEqual(reflexes.get("closed_fist"), { tap: "end_talk" });
});

test("reflex table: an unknown action is rejected", () => {
  assert.throws(() => loadReflexTable(mappingFile("victory: { tap: launch_rockets }\n")));
});

test("reflex table: a reflex with both hold and tap is rejected", () => {
  assert.throws(() => loadReflexTable(mappingFile("victory: { hold: talk, tap: discard }\n")));
});

test("reflex table: a missing file says to copy the example", () => {
  assert.throws(() => loadReflexTable("/nonexistent/gestures.yaml"), /gestures\.example\.yaml/);
});
