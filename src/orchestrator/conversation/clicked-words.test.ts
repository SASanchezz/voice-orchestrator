import { test } from "node:test";
import assert from "node:assert/strict";
import { ClickedWords } from "./clicked-words.js";

/** Clicked words whose silencing and sending are recorded in the order they happen. */
function clickedWords() {
  const happened: string[] = [];
  const replies = { silenceLatestReply: () => void happened.push("silenced") };
  const input = { receiveTyped: (text: string) => void happened.push(`sent: ${text}`) };
  return { words: new ClickedWords(replies, input), happened };
}

test("clicked words: the reply being said is silenced before the words are sent", () => {
  const { words, happened } = clickedWords();
  words.receiveTyped("confirm push");
  assert.deepEqual(happened, ["silenced", "sent: confirm push"]);
});
