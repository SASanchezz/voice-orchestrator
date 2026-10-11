// "Waiting for you": worker permission requests, answered by click.

import type { PendingRequestView } from "../protocol.js";
import { el, button, byId, timeAgo } from "./dom.js";
import { act } from "./api.js";
import { store } from "./store.js";

type Decision = "once" | "always" | "deny";

export function renderApprovals() {
  const { pending } = store.state;
  byId("approvals").hidden = !pending.length;
  byId("approval-list").replaceChildren(...pending.map(approvalCard));
}

function approvalCard(request: PendingRequestView): HTMLDivElement {
  const destructive = Boolean(request.destructiveVerb);
  const actions = destructive
    ? [button(`Allow ${request.destructiveVerb}…`, "danger", () => confirmDestructive(request)), button("Deny", "", () => void answer(request.id, "deny"))]
    : [
        button("Allow once", "primary", () => void answer(request.id, "once")),
        button("Always", "", () => void answer(request.id, "always")),
        button("Deny", "", () => void answer(request.id, "deny")),
      ];
  return el("div", { class: `approval${destructive ? " destructive" : ""}` },
    el("div", { class: "approval-head" },
      el("strong", {}, request.label),
      el("span", { class: "muted" }, destructive ? `destructive · ${request.destructiveVerb}` : "wants to run"),
      el("span", { class: "muted" }, `· ${timeAgo(request.createdAt)}`)),
    ...explanationOf(request),
    el("pre", { class: "command" }, request.description),
    el("div", { class: "approval-actions" }, ...actions));
}

/** Plain words above a destructive command: what it does and how risky it is. */
function explanationOf(request: PendingRequestView): HTMLParagraphElement[] {
  if (request.explanation) return [el("p", { class: "explanation" }, request.explanation)];
  if (request.explaining) return [el("p", { class: "explanation muted" }, "Explaining what this does…")];
  return [];
}

function answer(id: string, decision: Decision) {
  return act(`/api/permissions/${id}`, { decision });
}

function confirmDestructive(request: PendingRequestView) {
  const dialog = byId<HTMLDialogElement>("confirm-dialog");
  byId("confirm-title").textContent = `Allow ${request.destructiveVerb}?`;
  byId("confirm-project").textContent = `${request.label} wants to run:`;
  byId("confirm-explanation").textContent = request.explanation ?? "";
  byId("confirm-command").textContent = request.description;
  dialog.returnValue = "";
  dialog.onclose = () => {
    if (dialog.returnValue === "confirm") void answer(request.id, "once");
  };
  dialog.showModal();
  dialog.querySelector<HTMLButtonElement>(".ghost")?.focus(); // Enter must not approve by accident
}
