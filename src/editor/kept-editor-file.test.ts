import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { EditorCommand } from "./editor-server.js";
import { KeptEditorFile } from "./kept-editor-file.js";

/** A real process whose command line names its "CLI", standing in for a kept editor server. */
const STAND_IN_BIN = "sleep";
const COMMAND: EditorCommand = { bin: STAND_IN_BIN, args: ["serve-web"], port: 4778 };
const OTHER_PORT_COMMAND: EditorCommand = { ...COMMAND, port: 4779 };
const UNUSED_PID = 99_999_999;

const standIns: ChildProcess[] = [];
after(() => standIns.forEach((child) => child.kill()));

function runningStandIn(): number {
  const child = spawn(STAND_IN_BIN, ["30"], { stdio: "ignore", detached: true });
  standIns.push(child);
  if (child.pid === undefined) throw new Error("the stand-in didn't start");
  return child.pid;
}

function tempKeptFile(): { kept: KeptEditorFile; file: string } {
  const file = join(mkdtempSync(join(tmpdir(), "kept-editor-")), "kept-editor.json");
  return { kept: new KeptEditorFile(file), file };
}

function keptStandIn(): { kept: KeptEditorFile; file: string; pid: number } {
  const { kept, file } = tempKeptFile();
  const pid = runningStandIn();
  kept.save(pid, COMMAND);
  return { kept, file, pid };
}

test("kept editor: with nothing kept, none is running", () => {
  assert.equal(tempKeptFile().kept.isRunning(COMMAND), false);
});

test("kept editor: a kept editor that still runs the same command is running", () => {
  assert.equal(keptStandIn().kept.isRunning(COMMAND), true);
});

test("kept editor: one kept with other settings isn't taken over", () => {
  assert.equal(keptStandIn().kept.isRunning(OTHER_PORT_COMMAND), false);
});

test("kept editor: one whose process is gone isn't running", () => {
  const { kept } = tempKeptFile();
  kept.save(UNUSED_PID, COMMAND);
  assert.equal(kept.isRunning(COMMAND), false);
});

test("kept editor: an unreadable note counts as nothing kept", () => {
  const { kept, file } = tempKeptFile();
  writeFileSync(file, "{not json");
  assert.equal(kept.isRunning(COMMAND), false);
});

test("kept editor: taking it gives its pid", () => {
  const { kept, pid } = keptStandIn();
  assert.equal(kept.take(), pid);
});

test("kept editor: taking it uses the note up", () => {
  const { kept, file } = keptStandIn();
  kept.take();
  assert.equal(existsSync(file), false);
});

test("kept editor: a stale one is stopped, so it doesn't hold its port", async () => {
  const { kept } = keptStandIn();
  const standIn = standIns.at(-1);
  if (!standIn) throw new Error("no stand-in");
  kept.stopStale();
  await once(standIn, "exit");
  assert.equal(standIn.exitCode ?? standIn.signalCode, "SIGTERM");
});

test("kept editor: a stale one is forgotten", () => {
  const { kept, file } = keptStandIn();
  kept.stopStale();
  assert.equal(existsSync(file), false);
});
