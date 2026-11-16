import { test } from "node:test";
import assert from "node:assert/strict";
import { FrontSession } from "./front-session.js";

function withPageInFront(page: string, session: string): FrontSession {
  const front = new FrontSession();
  front.pageInFront(page, session);
  return front;
}

test("front session: with no page in front there is no session", () => {
  assert.equal(new FrontSession().hasSession(), false);
});

test("front session: asking for it with no page in front throws", () => {
  assert.throws(() => new FrontSession().session());
});

test("front session: the page in front gives its project tab's session", () => {
  assert.equal(withPageInFront("p1", "s1").session(), "s1");
});

test("front session: the page switching to another project gives that session", () => {
  const front = withPageInFront("p1", "s1");
  front.pageInFront("p1", "s2");
  assert.equal(front.session(), "s2");
});

test("front session: the page leaving the front leaves no session", () => {
  const front = withPageInFront("p1", "s1");
  front.pageLeftFront("p1");
  assert.equal(front.hasSession(), false);
});

test("front session: another page leaving the front keeps the one in front", () => {
  const front = withPageInFront("p1", "s1");
  front.pageLeftFront("p2");
  assert.equal(front.session(), "s1");
});
