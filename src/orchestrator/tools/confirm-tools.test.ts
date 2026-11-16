import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfirmAsk } from "../conversation/confirm-ask.js";
import { askGoAhead, askToConfirm } from "./confirm-tools.js";

/** Requests already answered for these verbs; none by default. */
function settledFor(verbs: string[] = []) {
  return { isSettled: (verb: string) => verbs.includes(verb) };
}

test("ask_to_confirm opens the request for its verbs", async () => {
  const ask = new ConfirmAsk();
  await askToConfirm(ask, settledFor()).call({ verbs: ["push"] });
  assert.deepEqual(ask.verbs, ["push"]);
});

test("ask_to_confirm refuses a verb that isn't one word", async () => {
  const ask = new ConfirmAsk();
  await askToConfirm(ask, settledFor()).call({ verbs: ["<verb>"] });
  assert.deepEqual(ask.verbs, []);
});

test("ask_to_confirm tells the model to end its turn, so the request isn't asked twice", async () => {
  const result = await askToConfirm(new ConfirmAsk(), settledFor()).call({ verbs: ["push"] });
  assert.match(JSON.stringify(result), /end your turn without more text/);
});

test("ask_to_confirm leaves out a verb whose request was already answered", async () => {
  const ask = new ConfirmAsk();
  await askToConfirm(ask, settledFor(["delete"])).call({ verbs: ["delete", "push"] });
  assert.deepEqual(ask.verbs, ["push"]);
});

test("ask_to_confirm shows nothing when every verb's request was already answered", async () => {
  const ask = new ConfirmAsk();
  await askToConfirm(ask, settledFor(["delete"])).call({ verbs: ["Delete"] });
  assert.deepEqual(ask.verbs, []);
});

test("ask_to_confirm tells the model when the request was already answered", async () => {
  const result = await askToConfirm(new ConfirmAsk(), settledFor(["delete"])).call({ verbs: ["delete"] });
  assert.match(JSON.stringify(result), /already been answered/);
});

test("ask_go_ahead opens a go-ahead question", async () => {
  const ask = new ConfirmAsk();
  await askGoAhead(ask).call({});
  assert.equal(ask.goAheadAsked, true);
});

test("ask_go_ahead tells the model to end its turn, so the question isn't asked twice", async () => {
  const result = await askGoAhead(new ConfirmAsk()).call({});
  assert.match(JSON.stringify(result), /end your turn without more text/);
});
