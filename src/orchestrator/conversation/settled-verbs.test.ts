import { test } from "node:test";
import assert from "node:assert/strict";
import { AppEvents } from "../../events/app-events.js";
import { ConversationLines } from "./conversation-lines.js";
import { SettledVerbs } from "./settled-verbs.js";

const SUBJECT = { project: "wicked-fe", session: "s8", label: "wicked-fe session 8" };

function followingSettled() {
  const events = new AppEvents();
  const lines = new ConversationLines();
  const settled = new SettledVerbs();
  settled.follow(events, lines);
  const request = (id: string, destructiveVerb?: string) =>
    events.emitEvent({
      kind: "permission",
      id,
      ...SUBJECT,
      description: "Bash: rm",
      command: "Bash: rm",
      destructiveVerb,
    });
  const answer = (id: string) => events.emitPermissionClosed(id);
  return { settled, lines, request, answer };
}

test("settled verbs: a waiting request's verb isn't settled", () => {
  const { settled, request } = followingSettled();
  request("p1", "delete");
  assert.equal(settled.isSettled("delete"), false);
});

test("settled verbs: an answered request's verb is settled", () => {
  const { settled, request, answer } = followingSettled();
  request("p1", "delete");
  answer("p1");
  assert.equal(settled.isSettled("delete"), true);
});

test("settled verbs: a verb another request still waits for isn't settled", () => {
  const { settled, request, answer } = followingSettled();
  request("p1", "delete");
  request("p2", "delete");
  answer("p1");
  assert.equal(settled.isSettled("delete"), false);
});

test("settled verbs: your next words make an answered verb askable again", () => {
  const { settled, lines, request, answer } = followingSettled();
  request("p1", "delete");
  answer("p1");
  lines.say({ role: "user", text: "now delete the old branch in my notes repo" });
  assert.equal(settled.isSettled("delete"), false);
});

test("settled verbs: the assistant's words keep an answered verb settled", () => {
  const { settled, lines, request, answer } = followingSettled();
  request("p1", "delete");
  answer("p1");
  lines.say({ role: "orchestrator", text: 'Say "confirm delete" to allow it.' });
  assert.equal(settled.isSettled("delete"), true);
});

test("settled verbs: answering the request says which verb settled", () => {
  const { settled, request, answer } = followingSettled();
  const heard: string[] = [];
  settled.on("settled", (verb: string) => heard.push(verb));
  request("p1", "delete");
  answer("p1");
  assert.deepEqual(heard, ["delete"]);
});

test("settled verbs: a request without a destructive verb settles nothing", () => {
  const { settled, request, answer } = followingSettled();
  const heard: string[] = [];
  settled.on("settled", (verb: string) => heard.push(verb));
  request("p1");
  answer("p1");
  assert.deepEqual(heard, []);
});
