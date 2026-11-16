import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfirmAsk } from "../../orchestrator/conversation/confirm-ask.js";
import { ConversationLines } from "../../orchestrator/conversation/conversation-lines.js";
import { TestChatPanels } from "../../testing/test-chat-panels.js";
import { AssistantChatPopup } from "./assistant-chat-popup.js";

const REPLY = "Sent to prewins session 10.";
const QUESTION = "what's session 10 doing?";
const TURN_STARTED_AT = 0;

/** Ends the assistant's turn, as the turn context does once its reply is finished. */
class TestTurns {
  private listeners: ((startedAt: number) => void)[] = [];

  onTurnEnd(listener: (startedAt: number) => void): void {
    this.listeners.push(listener);
  }

  end(): void {
    this.listeners.forEach((listener) => listener(TURN_STARTED_AT));
  }
}

/** Words typed for you, and each cut-off of the reply being said, in order. */
function recordedWords() {
  const typed: string[] = [];
  const silences: string[] = [];
  const typedWords = {
    receiveTyped: (text: string) => void typed.push(text),
    silenceReply: () => void silences.push("reply"),
  };
  return { typed, silences, typedWords };
}

/** The chat pop-up following the conversation; records the words its clicks and messages typed. */
function chat() {
  const lines = new ConversationLines();
  const ask = new ConfirmAsk();
  ask.follow(lines);
  const turns = new TestTurns();
  const panels = new TestChatPanels();
  const { typed, silences, typedWords } = recordedWords();
  new AssistantChatPopup(panels, typedWords, ask).follow(lines, turns);
  /** You ask, and the assistant answers you. */
  const reply = (text: string) => {
    lines.say({ role: "user", text: QUESTION });
    lines.say({ role: "orchestrator", text });
    turns.end();
  };
  /** The assistant speaks about a notification, in a turn you didn't start. */
  const notify = (text: string) => {
    lines.say({ role: "orchestrator", text });
    turns.end();
  };
  return { lines, ask, turns, panels, typed, silences, reply, notify };
}

test("chat popup: a finished reply opens it with the dialogue", () => {
  const { reply, panels } = chat();
  reply(REPLY);
  assert.deepEqual(panels.latest().view, {
    title: "Assistant",
    offersApproval: false,
    lines: [
      { role: "user", text: QUESTION },
      { role: "orchestrator", text: REPLY },
    ],
  });
});

test("chat popup: a reply to a notification opens nothing", () => {
  const { notify, panels } = chat();
  notify("Prewins wants to run a query. Confirm, confirm always, or deny?");
  assert.equal(panels.opened.length, 0);
});

test("chat popup: a reply to a notification stays out of the open pop-up", () => {
  const { reply, notify, panels } = chat();
  reply(REPLY);
  notify("Session 10 finished.");
  assert.deepEqual(panels.latest().view?.lines.at(-1), { role: "orchestrator", text: REPLY });
});

test("chat popup: a reply to a notification doesn't bring the open pop-up to the front", () => {
  const { reply, notify, panels } = chat();
  reply(REPLY);
  notify("Session 10 finished.");
  assert.equal(panels.latest().raised, 1);
});

test("chat popup: an answer's first words bring it up before the turn ends", () => {
  const { lines, panels } = chat();
  lines.say({ role: "user", text: QUESTION });
  lines.say({ role: "orchestrator", text: REPLY });
  assert.equal(panels.latest().raised, 1);
});

test("chat popup: the rest of the answer brings it to the front no more", () => {
  const { lines, panels } = chat();
  lines.say({ role: "user", text: QUESTION });
  lines.say({ role: "orchestrator", text: REPLY });
  lines.say({ role: "orchestrator", text: "It is running the tests." });
  assert.equal(panels.latest().raised, 1);
});

test("chat popup: a finished reply brings it to the front", () => {
  const { reply, panels } = chat();
  reply(REPLY);
  assert.equal(panels.latest().raised, 1);
});

test("chat popup: the next reply raises the open pop-up instead of opening another", () => {
  const { reply, panels } = chat();
  reply(REPLY);
  reply("Session 10 finished.");
  assert.deepEqual(
    panels.opened.map((panel) => panel.raised),
    [2],
  );
});

test("chat popup: after you close it, the next reply opens a new one", () => {
  const { reply, panels } = chat();
  reply(REPLY);
  panels.latest().events.closed();
  reply("Session 10 finished.");
  assert.equal(panels.opened.length, 2);
});

test("chat popup: your words show in the open pop-up right away", () => {
  const { lines, reply, panels } = chat();
  reply(REPLY);
  lines.say({ role: "user", text: "thanks" });
  assert.deepEqual(panels.latest().view?.lines.at(-1), { role: "user", text: "thanks" });
});

test("chat popup: a go-ahead question gets the go-ahead title", () => {
  const { lines, ask, turns, panels } = chat();
  lines.say({ role: "user", text: QUESTION });
  lines.say({ role: "orchestrator", text: "Shall I start?" });
  ask.askGoAhead();
  turns.end();
  assert.equal(panels.latest().view?.title, "Assistant waits for your go-ahead");
});

test("chat popup: a reply ending in a question offers Deny and Approve", () => {
  const { reply, panels } = chat();
  reply("Shall I send it to session 10?");
  assert.equal(panels.latest().view?.offersApproval, true);
});

test("chat popup: a go-ahead question offers Deny and Approve", () => {
  const { lines, ask, turns, panels } = chat();
  lines.say({ role: "user", text: QUESTION });
  lines.say({ role: "orchestrator", text: "I'll start the refactor." });
  ask.askGoAhead();
  turns.end();
  assert.equal(panels.latest().view?.offersApproval, true);
});

test("chat popup: a turn without text opens nothing", () => {
  const { turns, panels } = chat();
  turns.end();
  assert.equal(panels.opened.length, 0);
});

test("chat popup: an answer while a confirm phrase is asked opens nothing", () => {
  const { lines, ask, turns, panels } = chat();
  lines.say({ role: "user", text: QUESTION });
  ask.ask(["push"]);
  lines.say({ role: "orchestrator", text: 'Say "confirm push".' });
  turns.end();
  assert.equal(panels.opened.length, 0);
});

test("chat popup: Approve types yes", () => {
  const { reply, panels, typed } = chat();
  reply(REPLY);
  panels.latest().events.chosen("yes");
  assert.deepEqual(typed, ["yes"]);
});

test("chat popup: Deny types cancel", () => {
  const { reply, panels, typed } = chat();
  reply(REPLY);
  panels.latest().events.chosen("cancel");
  assert.deepEqual(typed, ["cancel"]);
});

test("chat popup: a message is typed as your words", () => {
  const { reply, panels, typed } = chat();
  reply(REPLY);
  panels.latest().events.chosen("text:send it to session 9");
  assert.deepEqual(typed, ["send it to session 9"]);
});

test("chat popup: a click into it cuts off the reply being said", () => {
  const { reply, panels, silences } = chat();
  reply("Here is the plan.");
  panels.latest().events.seen();
  assert.deepEqual(silences, ["reply"]);
});

test("chat popup: a click off its buttons types nothing", () => {
  const { reply, panels, typed } = chat();
  reply("Here is the plan.");
  panels.latest().events.seen();
  assert.deepEqual(typed, []);
});
