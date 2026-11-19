import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeSlack } from "../../testing/fake-slack.js";
import { checkEventsToken, socketUrl } from "./slack-events-token.js";

function answering(body: object): FakeSlack {
  return new FakeSlack({ "apps.connections.open": () => body });
}

test("slack events token: a working app-level token passes", async () => {
  const slack = answering({ url: "wss://wss.slack.com/link" });
  await checkEventsToken("xapp-1", slack.fetch);
  assert.equal(slack.callsTo("apps.connections.open").length, 1);
});

test("slack events token: the token is sent as the bearer", async () => {
  const slack = answering({ url: "wss://wss.slack.com/link" });
  await checkEventsToken("xapp-1", slack.fetch);
  assert.equal(slack.calls[0].authorization, "Bearer xapp-1");
});

test("slack events token: a user token is refused before anything is sent", async () => {
  const slack = answering({});
  await assert.rejects(checkEventsToken("xoxp-1", slack.fetch), /should start with xapp-/);
  assert.equal(slack.calls.length, 0);
});

test("slack events token: a missing scope names connections:write", async () => {
  const slack = answering({ ok: false, error: "missing_scope" });
  await assert.rejects(checkEventsToken("xapp-1", slack.fetch), /connections:write/);
});

test("slack events token: any other failure points at Socket Mode", async () => {
  const slack = answering({ ok: false, error: "invalid_auth" });
  await assert.rejects(checkEventsToken("xapp-1", slack.fetch), /invalid_auth.*Socket Mode/);
});

test("slack events token: the socket address is Slack's", async () => {
  const slack = answering({ url: "wss://wss.slack.com/link" });
  assert.equal(await socketUrl("xapp-1", slack.fetch), "wss://wss.slack.com/link");
});

test("slack events token: an answer without an address is a failure", async () => {
  await assert.rejects(socketUrl("xapp-1", answering({}).fetch), /didn't accept the app-level token/);
});
