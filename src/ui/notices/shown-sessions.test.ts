import { test } from "node:test";
import assert from "node:assert/strict";
import { ShownSessions } from "./shown-sessions.js";

function showing(...pagesAndSessions: [string, string][]): ShownSessions {
  const shownSessions = new ShownSessions();
  pagesAndSessions.forEach(([page, session]) => shownSessions.pageShows(page, session));
  return shownSessions;
}

test("shown sessions: no page open shows no session", () => {
  assert.equal(new ShownSessions().isShown("s1"), false);
});

test("shown sessions: a page's session is shown", () => {
  assert.equal(showing(["p1", "s1"]).isShown("s1"), true);
});

test("shown sessions: another session than the page's is not shown", () => {
  assert.equal(showing(["p1", "s2"]).isShown("s1"), false);
});

test("shown sessions: a page moving to another session no longer shows the first", () => {
  assert.equal(showing(["p1", "s1"], ["p1", "s2"]).isShown("s1"), false);
});

test("shown sessions: a page moving to the assistant shows no session", () => {
  const shownSessions = showing(["p1", "s1"]);
  shownSessions.pageShowsNoSession("p1");
  assert.equal(shownSessions.isShown("s1"), false);
});

test("shown sessions: one of two pages showing the session is enough", () => {
  assert.equal(showing(["p1", "s1"], ["p2", "s2"]).isShown("s1"), true);
});
