import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeSlack } from "../../testing/fake-slack.js";
import { readOnlyApp } from "./slack-manifest.js";
import { checkSlackToken } from "./slack-token-check.js";

const NEEDED = readOnlyApp().scopes;

function answering(body: object, scopes: string): FakeSlack {
  const headers = { "Content-Type": "application/json", "x-oauth-scopes": scopes };
  return new FakeSlack({ "auth.test": () => new Response(JSON.stringify(body), { headers }) });
}

test("slack setup: a working token gives its workspace and user", async () => {
  const slack = answering({ ok: true, team: "Acme", user: "alex" }, NEEDED.join(","));
  assert.deepEqual(await checkSlackToken("xoxp-1", NEEDED, slack.fetch), {
    team: "Acme",
    user: "alex",
    missingScopes: [],
  });
});

test("slack setup: missing scopes are listed", async () => {
  const slack = answering({ ok: true, team: "Acme", user: "alex" }, "im:read,im:history");
  const { missingScopes } = await checkSlackToken("xoxp-1", NEEDED, slack.fetch);
  assert.deepEqual(missingScopes, [
    "mpim:read",
    "mpim:history",
    "channels:read",
    "channels:history",
    "groups:read",
    "groups:history",
    "users:read",
    "search:read",
    "files:read",
  ]);
});

test("slack setup: a bot token is refused before anything is sent", async () => {
  const slack = answering({ ok: true }, "");
  await assert.rejects(checkSlackToken("xoxb-1", NEEDED, slack.fetch), /should start with xoxp-/);
  assert.equal(slack.calls.length, 0);
});

test("slack setup: a token Slack rejects says why", async () => {
  const slack = answering({ ok: false, error: "invalid_auth" }, "");
  await assert.rejects(checkSlackToken("xoxp-1", NEEDED, slack.fetch), /didn't accept the token \(invalid_auth\)/);
});
