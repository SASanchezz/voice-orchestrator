import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeSlack } from "../../testing/fake-slack.js";
import { SlackClient } from "./slack-client.js";
import { SlackNewMessages } from "./slack-new-messages.js";
import { openWorkspace } from "./slack-workspace.js";

const BEFORE_START_TS = "1762333000.000100";

interface SlackMessageStub {
  ts: string;
  user: string;
  subtype?: string;
}

/** A DM with Bob whose history the test adds to; it answers like conversations.history, newest first. */
class BobDm {
  readonly messages: SlackMessageStub[] = [{ ts: BEFORE_START_TS, user: "UBOB" }];

  readonly slack = new FakeSlack({
    "auth.test": () => ({ user_id: "UME" }),
    "users.info": () => ({ user: { name: "Bob" } }),
    "conversations.history": (params) => ({ messages: this.after(params) }),
  });

  add(message: SlackMessageStub): void {
    this.messages.push(message);
  }

  private after(params: URLSearchParams): SlackMessageStub[] {
    const oldest = Number(params.get("oldest"));
    const limit = Number(params.get("limit"));
    return this.messages
      .filter((message) => Number(message.ts) > oldest)
      .toReversed()
      .slice(0, limit);
  }
}

async function checking(dm: BobDm, heard: string[]): Promise<SlackNewMessages> {
  const open = async () => new SlackClient("xoxp-test", dm.slack.fetch, async () => {});
  const workspace = await openWorkspace(open, "acme", new Map());
  const watched = [{ id: "D1", name: "Bob" }];
  return new SlackNewMessages(workspace, watched, (chat, from) => heard.push(`${chat}/${from}`));
}

test("slack new messages: what was there before the first check isn't announced", async () => {
  const heard: string[] = [];
  await (await checking(new BobDm(), heard)).check();
  assert.deepEqual(heard, []);
});

test("slack new messages: a message after the first check is heard with its sender", async () => {
  const dm = new BobDm();
  const heard: string[] = [];
  const newMessages = await checking(dm, heard);
  await newMessages.check();
  dm.add({ ts: "1762333100.000100", user: "UBOB" });
  await newMessages.check();
  assert.deepEqual(heard, ["Bob/Bob"]);
});

test("slack new messages: a message is heard only once", async () => {
  const dm = new BobDm();
  const heard: string[] = [];
  const newMessages = await checking(dm, heard);
  await newMessages.check();
  dm.add({ ts: "1762333100.000100", user: "UBOB" });
  await newMessages.check();
  await newMessages.check();
  assert.equal(heard.length, 1);
});

test("slack new messages: your own messages and channel notices aren't heard", async () => {
  const dm = new BobDm();
  const heard: string[] = [];
  const newMessages = await checking(dm, heard);
  await newMessages.check();
  dm.add({ ts: "1762333100.000100", user: "UME" });
  dm.add({ ts: "1762333200.000100", user: "UBOB", subtype: "channel_join" });
  await newMessages.check();
  assert.deepEqual(heard, []);
});
