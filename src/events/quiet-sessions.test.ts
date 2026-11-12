import { test } from "node:test";
import assert from "node:assert/strict";
import { AppEvents, type AppEvent } from "./app-events.js";
import { QuietSessions } from "./quiet-sessions.js";

const doneIn = (session: string): AppEvent => ({
  kind: "task_done",
  project: "webshop",
  session,
  label: "webshop",
  task: "Fix the footer",
  sessionNumber: 1,
  result: "Done.",
  note: "Done.",
});

const heardEvents = () => {
  const events = new AppEvents();
  const quiet = new QuietSessions();
  const heard: string[] = [];
  quiet.audible(events).on("event", (e: AppEvent) => heard.push(e.session));
  return { events, quiet, heard };
};

test("quiet sessions: a quiet session's events make no sound", () => {
  const { events, quiet, heard } = heardEvents();
  quiet.keepQuiet("s1");
  events.emitEvent(doneIn("s1"));
  assert.deepEqual(heard, []);
});

test("quiet sessions: other sessions are still heard", () => {
  const { events, quiet, heard } = heardEvents();
  quiet.keepQuiet("s1");
  events.emitEvent(doneIn("s2"));
  assert.deepEqual(heard, ["s2"]);
});

test("quiet sessions: once you are back, every session is heard again", () => {
  const { events, quiet, heard } = heardEvents();
  quiet.keepQuiet("s1");
  quiet.wake();
  events.emitEvent(doneIn("s1"));
  assert.deepEqual(heard, ["s1"]);
});

test("quiet sessions: closing a request reaches pop-ups unchanged", () => {
  const events = new AppEvents();
  const closed: unknown[] = [];
  new QuietSessions().audible(events).on("permission_closed", (id: unknown) => closed.push(id));
  events.emitPermissionClosed("r1");
  assert.deepEqual(closed, ["r1"]);
});
