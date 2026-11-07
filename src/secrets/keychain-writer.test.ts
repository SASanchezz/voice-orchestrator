import assert from "node:assert/strict";
import { test } from "node:test";
import { addPasswordCommand, KeychainWriter } from "./keychain-writer.js";

const SESSION = "1BAAOMTQ5LjE1NC4xNjcuOTEAUA+abc/def==";

test("keychain writer: the secret goes on stdin, never in the arguments", async () => {
  const calls: { args: string[]; input: string }[] = [];
  await new KeychainWriter(async (_file, args, input) => {
    calls.push({ args, input });
  }).save("voice-orchestrator.telegram", "session", SESSION);
  assert.deepEqual(calls[0].args, ["-i"]);
});

test("keychain writer: stdin holds an add-or-replace command", () => {
  assert.equal(
    addPasswordCommand("voice-orchestrator.telegram", "session", SESSION),
    `add-generic-password -U -s "voice-orchestrator.telegram" -a "session" -w "${SESSION}"\n`,
  );
});

test("keychain writer: a value that would need quoting is refused", () => {
  assert.throws(() => addPasswordCommand("svc", "session", 'abc" ; delete-keychain'), /can't be passed safely/);
});
