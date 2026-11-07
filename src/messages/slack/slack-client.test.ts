import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { FakeSlack, rateLimited } from "../../testing/fake-slack.js";
import { SlackClient } from "./slack-client.js";

const userSchema = z.object({ user_id: z.string() });

function clientFor(slack: FakeSlack, waits: number[] = []): SlackClient {
  return new SlackClient("xoxp-test", slack.fetch, async (ms) => {
    waits.push(ms);
  });
}

test("slack client: returns the checked response", async () => {
  const slack = new FakeSlack({ "auth.test": () => ({ user_id: "U1" }) });
  assert.deepEqual(await clientFor(slack).call("auth.test", {}, userSchema), { user_id: "U1" });
});

test("slack client: sends the token as a Bearer header", async () => {
  const slack = new FakeSlack({ "auth.test": () => ({ user_id: "U1" }) });
  await clientFor(slack).call("auth.test", {}, userSchema);
  assert.equal(slack.calls[0].authorization, "Bearer xoxp-test");
});

test("slack client: a 429 waits for Retry-After and tries again", async () => {
  let attempts = 0;
  const slack = new FakeSlack({ "auth.test": () => (++attempts === 1 ? rateLimited(3) : { user_id: "U1" }) });
  const waits: number[] = [];
  await clientFor(slack, waits).call("auth.test", {}, userSchema);
  assert.deepEqual(waits, [3000]);
});

test("slack client: gives up after repeated 429s", async () => {
  const slack = new FakeSlack({ "auth.test": () => rateLimited(1) });
  await assert.rejects(clientFor(slack).call("auth.test", {}, userSchema), /rate limiting auth.test/);
});

test("slack client: a rejected token says to make a new one", async () => {
  const slack = new FakeSlack({ "auth.test": () => ({ ok: false, error: "token_revoked" }) });
  await assert.rejects(clientFor(slack).call("auth.test", {}, userSchema), /rejected the token \(token_revoked\)/);
});

test("slack client: a response of the wrong shape is an error", async () => {
  const slack = new FakeSlack({ "auth.test": () => ({ user_id: 7 }) });
  await assert.rejects(clientFor(slack).call("auth.test", {}, userSchema));
});
