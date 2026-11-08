import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfirmAsk } from "../conversation/confirm-ask.js";
import { askToConfirm } from "./confirm-tools.js";

test("ask_to_confirm opens the request for its verbs", async () => {
  const ask = new ConfirmAsk();
  await askToConfirm(ask).call({ verbs: ["push"] });
  assert.deepEqual(ask.verbs, ["push"]);
});

test("ask_to_confirm refuses a verb that isn't one word", async () => {
  const ask = new ConfirmAsk();
  await askToConfirm(ask).call({ verbs: ["<verb>"] });
  assert.deepEqual(ask.verbs, []);
});

test("ask_to_confirm tells the model to end its turn, so the request isn't asked twice", async () => {
  const result = await askToConfirm(new ConfirmAsk()).call({ verbs: ["push"] });
  assert.match(JSON.stringify(result), /end your turn without more text/);
});
