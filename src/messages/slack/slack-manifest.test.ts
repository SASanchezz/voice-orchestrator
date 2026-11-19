import assert from "node:assert/strict";
import { test } from "node:test";
import { appFor, newAppLink, readOnlyApp, replyingApp } from "./slack-manifest.js";

function manifestOf(link: string): unknown {
  return JSON.parse(new URL(link).searchParams.get("manifest_json") ?? "{}");
}

test("slack manifest: channels are readable even with none named, for All chats", () => {
  assert.ok(readOnlyApp().scopes.includes("channels:history"));
});

test("slack manifest: private channels are readable too", () => {
  assert.ok(readOnlyApp().scopes.includes("groups:history"));
});

test("slack manifest: the read-only app can't post", () => {
  assert.ok(!readOnlyApp().scopes.includes("chat:write"));
});

test("slack manifest: the read-only app gets no events", () => {
  assert.deepEqual(readOnlyApp().userEvents, []);
});

test("slack manifest: the replying app can post as you", () => {
  assert.ok(replyingApp([]).scopes.includes("chat:write"));
});

test("slack manifest: the replying app gets DMs and group DMs pushed", () => {
  assert.deepEqual(replyingApp([]).userEvents, ["message.im", "message.mpim"]);
});

test("slack manifest: named channels add the channel events", () => {
  assert.deepEqual(replyingApp(["general"]).userEvents.slice(2), ["message.channels", "message.groups"]);
});

test("slack manifest: send in config picks the replying app", () => {
  assert.deepEqual(appFor({ channels: [], send: true }), replyingApp([]));
});

test("slack manifest: no send in config picks the read-only app", () => {
  assert.deepEqual(appFor({ channels: [], send: false }), readOnlyApp());
});

test("slack manifest: the read-only link asks only for the user read scopes", () => {
  const app = readOnlyApp();
  assert.deepEqual(manifestOf(newAppLink(app)), {
    display_information: { name: app.name, description: app.description },
    oauth_config: { scopes: { user: app.scopes } },
    settings: { socket_mode_enabled: false, org_deploy_enabled: false, token_rotation_enabled: false },
  });
});

test("slack manifest: the replying link turns on Socket Mode with the user events", () => {
  const app = replyingApp([]);
  assert.deepEqual(manifestOf(newAppLink(app)), {
    display_information: { name: app.name, description: app.description },
    oauth_config: { scopes: { user: app.scopes } },
    settings: {
      socket_mode_enabled: true,
      event_subscriptions: { user_events: app.userEvents },
      org_deploy_enabled: false,
      token_rotation_enabled: false,
    },
  });
});
