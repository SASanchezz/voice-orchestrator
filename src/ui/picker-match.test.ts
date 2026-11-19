import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesQuery, matchingOptions, type PickerOption } from "./picker-match.js";

function option(label: string, detail = ""): PickerOption {
  return { value: label, label, detail };
}

const BRANCHES = [option("origin/feature/login"), option("main", "current"), option("feature/login-page")];

function labelsMatching(query: string): string[] {
  return matchingOptions(BRANCHES, query).map((match) => match.label);
}

test("picker match: an empty query keeps every option in order", () => {
  assert.deepEqual(labelsMatching(""), ["origin/feature/login", "main", "feature/login-page"]);
});

test("picker match: every word must appear, in any order", () => {
  assert.deepEqual(labelsMatching("page login"), ["feature/login-page"]);
});

test("picker match: case doesn't matter", () => {
  assert.deepEqual(labelsMatching("MAIN"), ["main"]);
});

test("picker match: the detail is searched too", () => {
  assert.deepEqual(labelsMatching("current"), ["main"]);
});

test("picker match: labels that start with the query come first", () => {
  assert.deepEqual(labelsMatching("feature"), ["feature/login-page", "origin/feature/login"]);
});

test("picker match: a text matches when it holds every word of the query", () => {
  assert.equal(matchesQuery("wicked-fe shop/a.ts", "a.ts wicked"), true);
});

test("picker match: a text missing one word doesn't match", () => {
  assert.equal(matchesQuery("wicked-fe", "wicked admin"), false);
});
