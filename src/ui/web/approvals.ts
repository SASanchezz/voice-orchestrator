// "Waiting for you": worker permission requests, answered by click. Workers' questions share the section.

import type { PendingRequestView } from "../protocol.js";
import { act } from "./api.js";
import { button, byId, confirmInDialog, el, timeAgo } from "./dom.js";
import { store } from "./store.js";

type Decision = "once" | "always" | "deny";

export function renderApprovals(): void {
  const { pending, questions } = store.state;
  byId("approvals", HTMLElement).hidden = !pending.length && !questions.length;
  byId("approval-list", HTMLElement).replaceChildren(...pending.map(approvalCard));
}

function approvalCard(request: PendingRequestView): HTMLDivElement {
  const destructive = Boolean(request.destructiveVerb);
  return el(
    "div",
    { class: `approval${destructive ? " destructive" : ""}` },
    cardHead(request),
    ...explanationOf(request),
    el("pre", { class: "command" }, request.description),
    el("div", { class: "approval-actions" }, ...actionsFor(request)),
  );
}

function cardHead(request: PendingRequestView): HTMLDivElement {
  const kind = request.destructiveVerb ? `destructive · ${request.destructiveVerb}` : "wants to run";
  return el(
    "div",
    { class: "approval-head" },
    el("strong", {}, request.label),
    el("span", { class: "muted" }, kind),
    el("span", { class: "muted" }, `· ${timeAgo(request.createdAt)}`),
  );
}

function actionsFor(request: PendingRequestView): HTMLButtonElement[] {
  const deny = button("Deny", "", () => void answer(request.id, "deny"));
  if (request.destructiveVerb)
    return [button(`Allow ${request.destructiveVerb}…`, "danger", () => confirmDestructive(request)), deny];
  return [
    button("Allow once", "primary", () => void answer(request.id, "once")),
    button("Always", "", () => void answer(request.id, "always")),
    deny,
  ];
}

/** Plain words above the command: what it does and how risky it is. */
function explanationOf(request: PendingRequestView): HTMLParagraphElement[] {
  if (request.explanation) return [el("p", { class: "explanation" }, request.explanation)];
  if (request.explaining) return [el("p", { class: "explanation muted" }, "Explaining what this does…")];
  return [];
}

function answer(id: string, decision: Decision): Promise<string | undefined> {
  return act(`/api/permissions/${id}`, { decision });
}

function confirmDestructive(request: PendingRequestView): void {
  byId("confirm-title", HTMLElement).textContent = `Allow ${request.destructiveVerb}?`;
  byId("confirm-project", HTMLElement).textContent = `${request.label} wants to run:`;
  byId("confirm-explanation", HTMLElement).textContent = request.explanation ?? "";
  byId("confirm-command", HTMLElement).textContent = request.description;
  confirmInDialog(byId("confirm-dialog", HTMLDialogElement), () => void answer(request.id, "once"));
}
