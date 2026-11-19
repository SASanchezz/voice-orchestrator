import assert from "node:assert/strict";
import { test } from "node:test";
import { keychainHolding } from "../../testing/fake-keychain.js";
import { FakeSlack } from "../../testing/fake-slack.js";
import type { EventSocket } from "./event-socket.js";
import { replyingApp } from "./slack-manifest.js";
import { SlackSetupCheck } from "./slack-setup-check.js";

const ACME = { workspace: "acme", profile: "work", channels: [], notify: [], send: true };
const BOTH_TOKENS = { "voice-orchestrator.slack/acme": "xoxp-1", "voice-orchestrator.slack-events/acme": "xapp-1" };

function slack(scopes = replyingApp([]).scopes): FakeSlack {
  const headers = { "content-type": "application/json", "x-oauth-scopes": scopes.join(",") };
  return new FakeSlack({
    "auth.test": () => new Response(JSON.stringify({ ok: true, team: "Casini", user: "alex" }), { headers }),
    "apps.connections.open": () => ({ url: "wss://slack/test" }),
  });
}

/** A socket that says hello at once, as Slack does, naming the app. */
function helloSocket(): EventSocket {
  return {
    onText: (heard) =>
      queueMicrotask(() => heard(JSON.stringify({ type: "hello", connection_info: { app_id: "A1" } }))),
    onClose: () => {},
    send: () => {},
    close: () => {},
  };
}

async function checks(secrets: Record<string, string>, fake = slack()) {
  return new SlackSetupCheck(keychainHolding(secrets), fake.fetch, helloSocket).check(ACME);
}

test("slack setup check: working tokens pass both checks", async () => {
  assert.deepEqual(
    (await checks(BOTH_TOKENS)).map((check) => check.status),
    ["ok", "ok"],
  );
});

test("slack setup check: the user token says whose it is", async () => {
  assert.match((await checks(BOTH_TOKENS))[0].detail, /alex in Casini/);
});

test("slack setup check: the live connection names its app", async () => {
  assert.match((await checks(BOTH_TOKENS))[1].detail, /app A1/);
});

test("slack setup check: a missing user token gives the login command", async () => {
  const [user] = await checks({ "voice-orchestrator.slack-events/acme": "xapp-1" });
  assert.deepEqual([user.status, user.command], ["fail", "npm run slack-login -- acme"]);
});

test("slack setup check: a missing permission is named", async () => {
  const [user] = await checks(BOTH_TOKENS, slack(["im:read", "im:history"]));
  assert.match(user.detail, /chat:write/);
});

test("slack setup check: a missing app-level token gives its command", async () => {
  const [, app] = await checks({ "voice-orchestrator.slack/acme": "xoxp-1" });
  assert.deepEqual([app.status, app.command], ["fail", "npm run slack-events-login -- acme"]);
});
