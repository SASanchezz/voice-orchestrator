// The message box's model picker: a task typed to a session runs on the session's model, or on one picked for that
// task alone. The session's model stays as it is, and the picker goes back to it once the task is sent.

import { modelLabel, WORKER_MODELS, type WorkerModelChoice } from "../../workers/worker-models.js";
import type { ProjectView } from "../protocol.js";
import { byId, el } from "./dom.js";
import { sessionModelOf } from "./session-model.js";
import { activeSession } from "./store.js";

const SESSION_MODEL = "";

/** Hidden while the assistant's chat is shown: it has no worker. */
export function renderComposerModel(project: ProjectView | undefined): void {
  const picker = composerModel();
  picker.hidden = !project;
  if (!project) return;
  const sessionLabel = modelLabel(sessionModelOf(project, activeSession(project)));
  const options = [modelOption(SESSION_MODEL, `${sessionLabel} (session)`), ...WORKER_MODELS.map(oneOffOption)];
  replaceOptionsIfChanged(picker, options);
}

/** The model picked for the next task only; none while the session's own is selected. */
export function pickedModel(): string | undefined {
  const { value } = composerModel();
  return value === SESSION_MODEL ? undefined : value;
}

export function resetComposerModel(): void {
  composerModel().value = SESSION_MODEL;
}

function oneOffOption({ id, label }: WorkerModelChoice): HTMLOptionElement {
  return modelOption(id, `${label} (this task)`);
}

function modelOption(value: string, label: string): HTMLOptionElement {
  return el("option", { value }, label);
}

/** The page re-renders on every state push; rebuilding an open picker would close it under the pointer. */
function replaceOptionsIfChanged(picker: HTMLSelectElement, options: HTMLOptionElement[]): void {
  const isSame = optionTexts([...picker.options]) === optionTexts(options);
  if (isSame) return;
  const picked = picker.value;
  picker.replaceChildren(...options);
  picker.value = picked;
}

function optionTexts(options: HTMLOptionElement[]): string {
  return options.map((option) => option.text).join("\n");
}

function composerModel(): HTMLSelectElement {
  return byId("composer-model", HTMLSelectElement);
}
