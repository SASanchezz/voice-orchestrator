import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_DIR } from "../../config/paths.js";
import { app, voice } from "../support/harness.js";
import { mark } from "../support/helpers.js";
import { cfg, configFile, scratchpad } from "../support/sandbox.js";

const { core } = app;

test("removing a project needs the user to say confirm remove", async () => {
  let i = mark();
  voice.say("open scratchpad on personal");
  await voice.heard(/Opened scratchpad/, i);
  i = mark();
  voice.say("remove scratchpad");
  await voice.heard(/Not removed\. .*say "confirm remove"/, i);
  assert.ok(core.projects.has("scratchpad"));
});

test("a project with a running task is not removed until the user agrees to stop it", async () => {
  const i = mark();
  voice.say("in scratchpad do:\nsleep: 10000");
  await voice.heard(/Started on scratchpad/, i);
  voice.say("remove scratchpad, confirm remove");
  await voice.heard(/Not removed: scratchpad has a running task/, i);
  assert.ok(core.projects.has("scratchpad"));
});

test("a removed project is stopped and gone from the registry and config, but its folder stays", async () => {
  const i = mark();
  voice.say("stop and remove scratchpad, confirm remove");
  await voice.heard(/Removed scratchpad: .*Its folder is untouched/, i);
  const overlay = readFileSync(join(STATE_DIR, "projects.json"), "utf8");
  assert.deepEqual(
    [
      core.projects.has("scratchpad"),
      "scratchpad" in cfg.projects,
      overlay.includes("scratchpad"),
      existsSync(scratchpad),
    ],
    [false, false, false, true],
  );
});

test("a removed project is taken out of config.yaml; other projects and comments stay", () => {
  const yaml = readFileSync(configFile, "utf8");
  assert.deepEqual([yaml.includes("scratchpad:"), yaml.includes("keepme:")], [false, true]);
});

test("a removed project no longer shows in list_projects", async () => {
  const i = mark();
  voice.say("status");
  assert.doesNotMatch(await voice.heard(/dbadmin/, i), /scratchpad/);
});
