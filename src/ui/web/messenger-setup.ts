// ⚙ › Messengers: how to connect each messenger to catch-up, step by step. It only shows the steps: secrets are
// typed into a terminal, never into this page.

import { COMMON_STEPS, MESSENGER_GUIDES, SETUP_DOC, type GuideStep, type MessengerGuide } from "../messenger-guides.js";
import { byId, copyButton, el } from "./dom.js";
import { refreshMessengerStatus } from "./messenger-status.js";

export function wireMessengerSetup(): void {
  const dialog = byId("messenger-dialog", HTMLDialogElement);
  byId("messenger-guides", HTMLElement).replaceChildren(
    commonSteps(),
    ...MESSENGER_GUIDES.map(guideSection),
    docNote(),
  );
  byId("messengers-button", HTMLButtonElement).addEventListener("click", () => openCollapsed(dialog));
}

/** Each opening starts with every guide closed, whichever was open last time. */
function openCollapsed(dialog: HTMLDialogElement): void {
  for (const guide of dialog.querySelectorAll("details")) guide.open = false;
  dialog.scrollTop = 0;
  void refreshMessengerStatus();
  dialog.showModal();
}

function commonSteps(): HTMLElement {
  const steps = COMMON_STEPS.map((step) => el("li", {}, step));
  return el(
    "section",
    { class: "guide-basics" },
    el("h3", {}, "Every messenger, in four steps"),
    el("ol", {}, ...steps),
  );
}

function guideSection(guide: MessengerGuide): HTMLDetailsElement {
  const summary = el("summary", {}, el("strong", {}, guide.name), " ", el("span", { class: "muted" }, guide.reads));
  const steps = el("ol", {}, ...guide.steps.map(stepItem));
  return el("details", { class: "guide" }, summary, steps, configBlock(guide.config));
}

function stepItem(step: GuideStep): HTMLLIElement {
  const item = el("li", {}, step.text);
  if (step.link)
    item.append(" ", el("a", { href: step.link, target: "_blank", rel: "noopener noreferrer" }, step.link));
  if (step.command) item.append(copyableLine(step.command, "Copy the command"));
  return item;
}

function configBlock(config: string): HTMLElement {
  return el(
    "div",
    { class: "guide-config" },
    el("p", {}, "In config/config.yaml:"),
    copyableLine(config, "Copy the config"),
  );
}

function copyableLine(text: string, title: string): HTMLElement {
  return el("div", { class: "guide-copyable" }, el("pre", {}, text), copyButton(text, title));
}

function docNote(): HTMLElement {
  return el(
    "p",
    { class: "muted" },
    "The full guide, with how to replace or revoke access, is ",
    el("code", {}, SETUP_DOC),
    ".",
  );
}
