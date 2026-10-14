// The steps inside one folded block as a tree: a sub-agent's steps under the step that started it, and each
// permission request under the step that raised it. Imports only types, so the page compiles it too.

import type { ChatMessageView } from "./protocol.js";

/** A step, the permission requests it raised, and the steps of a sub-agent it started. */
export interface Step {
  message: ChatMessageView;
  approvals: ChatMessageView[];
  substeps: Step[];
}

/** "asks: Bash: npm test" and "asks: Edit: Edit src/app.ts" name the same calls as the steps "Bash npm test" and "Edit src/app.ts". */
const APPROVAL_PREFIX = /^asks: ([\w.-]+): (?:\1 )?/;
const CUT_MARK = "…";

export function newStep(message: ChatMessageView): Step {
  return { message, approvals: [], substeps: [] };
}

/** Puts the step under the step that started its sub-agent, when that one is in `steps`; otherwise at the end. */
export function addStep(steps: Step[], step: Step): void {
  const { parentToolUseId } = step.message;
  const parent = parentToolUseId ? allSteps(steps).find((s) => s.message.toolUseId === parentToolUseId) : undefined;
  (parent?.substeps ?? steps).push(step);
}

/** Puts the request under the latest step making the same call, or else under the latest tool call. */
export function addApproval(steps: Step[], approval: ChatMessageView): void {
  const calls = allSteps(steps)
    .filter((step) => step.message.kind === "tool")
    .toReversed();
  const owner = calls.find((step) => sameCall(step.message.text, calledBy(approval.text))) ?? calls[0];
  owner?.approvals.push(approval);
}

/** Whether any step in `steps` is a tool call a permission request can belong to. */
export function hasToolCall(steps: Step[]): boolean {
  return allSteps(steps).some((step) => step.message.kind === "tool");
}

/** Every step, sub-agents' included, in the order they happened. */
export function allSteps(steps: Step[]): Step[] {
  return steps.flatMap((step) => [step, ...allSteps(step.substeps)]).toSorted((a, b) => a.message.id - b.message.id);
}

/** How many lines the block holds, its steps' requests included; it changes whenever the block grows. */
export function lineCount(steps: Step[]): number {
  return allSteps(steps).reduce((count, step) => count + 1 + step.approvals.length, 0);
}

/** "Bash: npm test": what a permission request asks for, worded as in the approval panel. */
export function requestDescription(approvalText: string): string {
  return approvalText.replace(/^asks: /, "");
}

function calledBy(approvalText: string): string {
  return approvalText.replace(APPROVAL_PREFIX, "$1 ");
}

/** Both texts are cut at different lengths, so the shorter one must start the longer one. */
function sameCall(stepText: string, approvalCall: string): boolean {
  const call = approvalCall.endsWith(CUT_MARK) ? approvalCall.slice(0, -CUT_MARK.length) : approvalCall;
  const length = Math.min(stepText.length, call.length);
  return stepText.slice(0, length) === call.slice(0, length);
}
