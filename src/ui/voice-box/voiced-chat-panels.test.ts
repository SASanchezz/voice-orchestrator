import { test } from "node:test";
import assert from "node:assert/strict";
import { TestChatPanels } from "../../testing/test-chat-panels.js";
import type { ChatPanelEvents } from "../assistant-chat/chat-panel.js";
import { BoxChooser } from "./box-chooser.js";
import { PanelBoxes } from "./panel-box.js";
import type { PanelVoiceEvents } from "./voice-box.js";
import { VoicedChatPanels } from "./voiced-chat-panels.js";

/** Fake chat pop-ups that also keep the events each was opened with, voice events included. */
class VoicedFake extends TestChatPanels {
  inner: (ChatPanelEvents & PanelVoiceEvents)[] = [];

  open(events: ChatPanelEvents & PanelVoiceEvents) {
    this.inner.push(events);
    return super.open(events);
  }
}

/** The chat pop-up wrapped as a voice box; records what reached the pop-up's owner and the assistant as speech. */
function voicedChat() {
  const device = new VoicedFake();
  const chooser = new BoxChooser();
  const spoken: string[] = [];
  const happened: string[] = [];
  const panels = new VoicedChatPanels(device, new PanelBoxes(chooser, { stopToEdit: async () => {} }), {
    receive: (text) => String(spoken.push(text)),
  });
  const events: ChatPanelEvents = {
    chosen: (answer) => void happened.push(answer),
    seen: () => void happened.push("seen"),
    closed: () => void happened.push("closed"),
  };
  panels.open(events);
  const [inner] = device.inner;
  if (!inner) throw new Error("The chat pop-up didn't open.");
  return { device, chooser, spoken, happened, inner };
}

test("voiced chat: spoken words from the pop-up reach the assistant as speech", () => {
  const { inner, spoken } = voicedChat();
  inner.chosen("spoken:what changed?");
  assert.deepEqual(spoken, ["what changed?"]);
});

test("voiced chat: other answers go to the pop-up's owner as before", () => {
  const { inner, happened } = voicedChat();
  inner.chosen("text:hello");
  assert.deepEqual(happened, ["text:hello"]);
});

test("voiced chat: the pop-up coming to the front makes it the box for the next recording", () => {
  const { inner, chooser } = voicedChat();
  inner.cameToFront();
  assert.equal(chooser.hasBox(), true);
});

test("voiced chat: once closed, the pop-up takes no recording", () => {
  const { inner, chooser } = voicedChat();
  inner.cameToFront();
  inner.closed();
  assert.equal(chooser.hasBox(), false);
});

test("voiced chat: its closing still reaches its owner", () => {
  const { inner, happened } = voicedChat();
  inner.closed();
  assert.deepEqual(happened, ["closed"]);
});

test("voiced chat: the recording is told to the pop-up", () => {
  const { inner, chooser, device } = voicedChat();
  inner.cameToFront();
  chooser.box().tell({ kind: "words", words: "add" });
  assert.deepEqual(device.latest().told, [{ kind: "words", words: "add" }]);
});
