import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChatMessageView } from "./protocol.js";
import { addApproval, addStep, allSteps, newStep, type Step } from "./step-tree.js";

let nextId = 1;
function line(kind: ChatMessageView["kind"], text: string, ids: Partial<ChatMessageView> = {}): ChatMessageView {
  return { id: nextId++, at: "2026-10-14T09:00:00.000Z", kind, text, ...ids };
}
const approvalTexts = (steps: Step[]) => allSteps(steps).map((step) => step.approvals.map((a) => a.text));

test("step tree: a sub-agent's step goes under the step that started it", () => {
  const steps = [newStep(line("tool", "Agent Review the diff", { toolUseId: "agent-1" }))];
  addStep(steps, newStep(line("tool", "Read a.ts", { parentToolUseId: "agent-1" })));
  assert.deepEqual(
    steps[0]?.substeps.map((step) => step.message.text),
    ["Read a.ts"],
  );
});

test("step tree: a sub-agent's step whose parent is not in the block goes at the end", () => {
  const steps = [newStep(line("tool", "Bash ls"))];
  addStep(steps, newStep(line("tool", "Read a.ts", { parentToolUseId: "elsewhere" })));
  assert.equal(steps.length, 2);
});

test("step tree: steps list in the order they happened, sub-agents' included", () => {
  const steps = [newStep(line("tool", "Agent Review", { toolUseId: "agent-1" }))];
  addStep(steps, newStep(line("tool", "Bash ls")));
  addStep(steps, newStep(line("tool", "Read a.ts", { parentToolUseId: "agent-1" })));
  assert.deepEqual(
    allSteps(steps).map((step) => step.message.text),
    ["Agent Review", "Bash ls", "Read a.ts"],
  );
});

test("step tree: a permission request goes under the step making the same call", () => {
  const steps = [newStep(line("tool", "Bash rm -rf tmp")), newStep(line("tool", "Bash ls"))];
  addApproval(steps, line("permission", "asks: Bash: rm -rf tmp"));
  assert.deepEqual(approvalTexts(steps), [["asks: Bash: rm -rf tmp"], []]);
});

test("step tree: a request for a long command matches its shortened step", () => {
  const command = `cd /repo && ${"x".repeat(200)}`;
  const steps = [newStep(line("tool", `Bash ${command.slice(0, 80)}`)), newStep(line("tool", "Bash ls"))];
  addApproval(steps, line("permission", `asks: Bash: ${command.slice(0, 150)}…`));
  assert.equal(steps[0]?.approvals.length, 1);
});

test("step tree: a request for a file tool matches its step", () => {
  const steps = [newStep(line("tool", "Edit src/app.ts")), newStep(line("tool", "Bash ls"))];
  addApproval(steps, line("permission", "asks: Edit: Edit src/app.ts"));
  assert.equal(steps[0]?.approvals.length, 1);
});

test("step tree: a request matching no step goes under the latest tool call", () => {
  const steps = [newStep(line("tool", "Bash ls")), newStep(line("reply", "Checking."))];
  addApproval(steps, line("permission", "asks: WebFetch: https://example.com"));
  assert.deepEqual(approvalTexts(steps), [["asks: WebFetch: https://example.com"], []]);
});
