// Inside a folded steps block: each step with a sub-agent's steps nested under it, and the permission requests
// the steps raised, kept under the block's summary. A request waiting for you shows its whole command; once
// answered it folds to one line.

import { commandPreview } from "../permission-lines.js";
import type { ChatMessageView, PendingRequestView } from "../protocol.js";
import { allSteps, requestDescription, type Step } from "../step-tree.js";
import { sessionItem } from "./chat-items.js";
import { el, formatWhen } from "./dom.js";

/** The "Bash: " a request's description starts with; the step it sits under names the tool already. */
const TOOL_PREFIX = /^[\w.-]+: /;

export function stepItem(step: Step): HTMLLIElement {
  const item = sessionItem(step.message);
  if (step.approvals.length) item.querySelector(".entry-meta")?.append(el("span", { class: "asked-tag" }, "asked"));
  if (step.substeps.length) item.append(el("ol", { class: "steps-list substeps" }, ...step.substeps.map(stepItem)));
  return item;
}

export function approvalLines(steps: Step[]): HTMLDetailsElement[] {
  return allSteps(steps).flatMap((step) => step.approvals.map(approvalLine));
}

/** Opens the requests that wait for an answer and folds the ones answered since. */
export function markPendingApprovals(lines: HTMLElement[], pending: PendingRequestView[]): void {
  const waiting = new Set(pending.map((request) => request.description));
  for (const line of lines) {
    if (!(line instanceof HTMLDetailsElement)) continue;
    const isPending = waiting.has(line.dataset.description ?? "");
    if (isPending === line.classList.contains("pending")) continue;
    line.classList.toggle("pending", isPending);
    line.open = isPending;
  }
}

function approvalLine(approval: ChatMessageView): HTMLDetailsElement {
  const description = requestDescription(approval.text);
  const summary = el(
    "summary",
    {},
    el("span", { class: "approval-tag" }, "Approval"),
    el("span", { class: "permission-time" }, formatWhen(approval.at)),
    el("code", {}, commandPreview(description.replace(TOOL_PREFIX, ""))),
  );
  const line = el("details", { class: "step-approval" }, summary, el("pre", {}, description));
  line.dataset.description = description;
  return line;
}
