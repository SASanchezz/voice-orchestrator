import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromeProfileFolder, hasChromeProfile, profileNameOf } from "./chrome-profile-folders.js";

function localState(): string {
  const path = join(mkdtempSync(join(tmpdir(), "chrome-")), "Local State");
  const profiles = { Default: { name: "Personal" }, "Profile 2": { name: "Work" } };
  writeFileSync(path, JSON.stringify({ profile: { info_cache: profiles } }));
  return path;
}

test("chrome profile folders: a profile is found by the name Chrome shows", () => {
  assert.equal(chromeProfileFolder(localState(), "Work"), "Profile 2");
});

test("chrome profile folders: a profile is found by its folder name", () => {
  assert.equal(chromeProfileFolder(localState(), "Profile 2"), "Profile 2");
});

test("chrome profile folders: an unknown profile is an error naming it", () => {
  assert.throws(() => chromeProfileFolder(localState(), "Client X"), /no profile named "Client X"/);
});

test("chrome profile folders: a profile Chrome has is known", () => {
  assert.equal(hasChromeProfile(localState(), "Work"), true);
});

test("chrome profile folders: a profile Chrome lacks is unknown", () => {
  assert.equal(hasChromeProfile(localState(), "Client X"), false);
});

test("chrome profile folders: a folder is named as Chrome shows it", () => {
  assert.equal(profileNameOf(localState(), "Default"), "Personal");
});

test("chrome profile folders: a folder Chrome doesn't list is named by itself", () => {
  assert.equal(profileNameOf(localState(), "Profile 9"), "Profile 9");
});
