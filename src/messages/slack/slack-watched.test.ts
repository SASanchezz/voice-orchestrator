import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeSlack, type SlackRoute } from "../../testing/fake-slack.js";
import { SlackClient } from "./slack-client.js";
import { watchedConversations } from "./slack-watched.js";
import { openWorkspace, type SlackWorkspace } from "./slack-workspace.js";

const PEOPLE: Record<string, string> = { UBOB: "Bob", UANN: "Ann", UCY: "Cy" };

const ROUTES: Record<string, SlackRoute> = {
  "auth.test": () => ({ user_id: "UME" }),
  "conversations.list": (params) =>
    params.get("types") === "im,mpim"
      ? { channels: ["UBOB", "UANN", "UCY"].map((user) => ({ id: `D-${user}`, is_im: true, user })) }
      : { channels: [{ id: "C1", name: "general" }] },
  "users.info": (params) => ({ user: { name: PEOPLE[params.get("user") ?? ""] ?? "someone" } }),
};

async function workspaceOn(slack: FakeSlack): Promise<SlackWorkspace> {
  const open = async () => new SlackClient("xoxp-test", slack.fetch, async () => {});
  return openWorkspace(open, "acme", new Map());
}

test("slack watched: a DM is matched by its person's name", async () => {
  const workspace = await workspaceOn(new FakeSlack(ROUTES));
  const watched = await watchedConversations(workspace, { channels: [], notify: ["ann"] });
  assert.deepEqual(watched, [{ id: "D-UANN", name: "Ann" }]);
});

test("slack watched: a channel the catch-up reads is matched by its name", async () => {
  const workspace = await workspaceOn(new FakeSlack(ROUTES));
  const watched = await watchedConversations(workspace, { channels: ["general"], notify: ["general"] });
  assert.deepEqual(watched, [{ id: "C1", name: "#general" }]);
});

test("slack watched: a channel the catch-up doesn't read isn't matched", async () => {
  const workspace = await workspaceOn(new FakeSlack(ROUTES));
  assert.deepEqual(await watchedConversations(workspace, { channels: [], notify: ["general"] }), []);
});

test("slack watched: people's names are looked up only until every name is found", async () => {
  const slack = new FakeSlack(ROUTES);
  await watchedConversations(await workspaceOn(slack), { channels: [], notify: ["Bob"] });
  assert.equal(slack.callsTo("users.info").length, 1);
});
