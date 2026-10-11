import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operatorSessions } from "../support/fake-operator.js";
import { app } from "../support/harness.js";
import { notesFile } from "../support/sandbox.js";

test("standing rules from config reach the orchestrator", () => {
  assert.match(operatorSessions[0].systemPrompt, /standing rules[^\n]*\n- Call the user captain\./);
});

test("the user's notes reach the orchestrator", () => {
  assert.match(
    operatorSessions[0].systemPrompt,
    /user's notes[^\n]*\n# Assistant notes[\s\S]*- dbadmin is also called database admin\./,
  );
});

test("remember adds a line to the notes file", async () => {
  await app.operator.tools.callTool("remember", { note: "acme is the work frontend", section: "Project notes" });
  assert.match(readFileSync(notesFile, "utf8"), /## Project notes\n\n- acme is the work frontend\n/);
});

test("orchestrator runs on the personal account, has no built-in tools, uses the user's claude binary", () => {
  assert.equal(operatorSessions[0].account, "personal");
  assert.deepEqual(operatorSessions[0].tools, []);
  assert.equal(operatorSessions[0].bin, "/fake/claude");
});
