import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectView, SessionView } from "./protocol.js";
import { isPlaceEntry, isPlaceOpen, isSamePlace, placeOf, type PagePlace } from "./page-place.js";

function session(id: string): SessionView {
  return { id, number: 1, status: "idle", queued: [], costUsd: 0, history: [] };
}

function project(name: string, activeSession: string, ...sessionIds: string[]): ProjectView {
  const sessions = sessionIds.map(session);
  return { name, profile: "personal", folder: "", folderFromHome: "", activeSession, sessions };
}

const webshop = project("webshop", "s2", "s1", "s2");
const sessionTwoChat: PagePlace = { project: "webshop", sessionId: "s2", screen: "chat" };

test("a project's chat is the place of its active session", () => {
  assert.deepEqual(placeOf({ project: "webshop", screen: "chat" }, [webshop]), sessionTwoChat);
});

test("a project's To-do names no session", () => {
  const place = placeOf({ project: "webshop", screen: "todo" }, [webshop]);
  assert.equal(place.sessionId, "");
});

test("the assistant's chat names no session", () => {
  const place = placeOf({ project: "", screen: "chat" }, [webshop]);
  assert.deepEqual(place, { project: "", sessionId: "", screen: "chat" });
});

test("another session of the same project is another place", () => {
  const sessionOneChat = { ...sessionTwoChat, sessionId: "s1" };
  assert.equal(isSamePlace(sessionTwoChat, sessionOneChat), false);
});

test("the same project, session and screen are the same place", () => {
  assert.equal(isSamePlace(sessionTwoChat, { ...sessionTwoChat }), true);
});

test("a place whose session was closed is no longer open", () => {
  const closedSession = { ...sessionTwoChat, sessionId: "s9" };
  assert.equal(isPlaceOpen(closedSession, [webshop]), false);
});

test("a place whose project was closed is no longer open", () => {
  assert.equal(isPlaceOpen({ ...sessionTwoChat, project: "billing" }, [webshop]), false);
});

test("the assistant's chat is always open", () => {
  assert.equal(isPlaceOpen({ project: "", sessionId: "", screen: "chat" }, []), true);
});

test("a history entry of the page is recognised", () => {
  assert.equal(isPlaceEntry({ place: sessionTwoChat, index: 3 }), true);
});

test("a history entry left by something else is not", () => {
  assert.equal(isPlaceEntry({ place: { project: "webshop" }, index: 3 }), false);
});
