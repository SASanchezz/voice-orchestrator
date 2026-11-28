// The message box's model picker, as in Claude's own apps: a chip naming the session's model and thinking effort
// opens a panel to change either. A pick is the session's from then on, for every task typed or spoken to it.

import type { ProjectView, SessionView } from "../protocol.js";
import { byId } from "./dom.js";
import { effortChipParts, modelPickerColumns } from "./model-picker-items.js";
import { activeSession } from "./store.js";

export function wireComposerModel(): void {
  composerModel().addEventListener("click", toggleModelPicker);
  document.addEventListener("pointerdown", closeUnlessInPicker, { capture: true });
  document.addEventListener("keydown", closeOnEscape, { capture: true }); // before Escape discards a voice message
  window.addEventListener("blur", closeModelPicker);
}

/** Hidden while the assistant's chat is shown: it has no worker. */
export function renderComposerModel(project: ProjectView | undefined): void {
  const chip = composerModel();
  chip.hidden = !project;
  if (!project) return closeModelPicker();
  const session = activeSession(project);
  replaceIfChanged(chip, shownChoices(project, session), () => {
    chip.replaceChildren(...effortChipParts(project, session));
    modelPicker().replaceChildren(...modelPickerColumns(project, session));
  });
}

/** The page re-renders on every state push; rebuilding an open panel would drop the focus under the pointer. */
function replaceIfChanged(chip: HTMLButtonElement, choices: string, rebuild: () => void): void {
  if (chip.dataset.choices === choices) return;
  chip.dataset.choices = choices;
  rebuild();
}

function shownChoices(project: ProjectView, session: SessionView): string {
  return [session.id, session.model, session.effort, project.model, project.claudeModel, project.claudeEffort].join(
    "|",
  );
}

function toggleModelPicker(): void {
  const isOpen = !modelPicker().hidden;
  if (isOpen) return closeModelPicker();
  modelPicker().hidden = false;
  composerModel().setAttribute("aria-expanded", "true");
  modelPicker().querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus();
}

function closeModelPicker(): void {
  modelPicker().hidden = true;
  composerModel().setAttribute("aria-expanded", "false");
}

function closeUnlessInPicker(event: PointerEvent): void {
  const anchor = composerModel().parentElement;
  const isInPicker = event.target instanceof Node && Boolean(anchor?.contains(event.target));
  if (!isInPicker) closeModelPicker();
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || modelPicker().hidden) return;
  event.preventDefault();
  closeModelPicker();
  composerModel().focus();
}

function composerModel(): HTMLButtonElement {
  return byId("composer-model", HTMLButtonElement);
}

function modelPicker(): HTMLDivElement {
  return byId("model-picker", HTMLDivElement);
}
