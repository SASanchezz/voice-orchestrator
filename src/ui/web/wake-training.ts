// ⚙ › Wake word › Train…: record yourself saying the wake word and other talk, train a model on it, and try it out;
// Review recordings opens a window to listen back and delete poor takes. Each step records from the Mac's mic or
// trains, and the server answers when it's done.

import { fetchWakeRecordings, post } from "./api.js";
import { button, byId, el } from "./dom.js";
import { createWakeReview } from "./wake-review-dialog.js";

interface WakeStep {
  path: string;
  body: object;
  /** Shown while the step runs: what to do now. */
  doing: string;
}

const STEPS: Record<string, WakeStep> = {
  "record-wake": {
    path: "/api/wake-training/record",
    body: { label: "wake" },
    doing: "Recording: say “Hey Oracle” now…",
  },
  "record-other": {
    path: "/api/wake-training/record",
    body: { label: "other" },
    doing: "Recording for 6 seconds: talk about anything else, or let the room be as it usually is…",
  },
  train: { path: "/api/wake-training/train", body: {}, doing: "Training… (see the terminal for progress)" },
  try: { path: "/api/wake-training/try", body: {}, doing: "Listening for 3 seconds: say it now…" },
};
const STATUS_PATH = "/api/wake-training/status";
/** The step buttons, and Review recordings: none may run while another step does. */
const STEP_BUTTONS = "button[data-wake-step], button[data-wake-review]";
const REVIEW_HINT = "Listen back to your recordings, and delete the poor ones before training again.";

type StatusLook = "is-working" | "is-refused" | "";

export function wireWakeTraining(): void {
  const dialog = byId("wake-training-dialog", HTMLDialogElement);
  addReviewButton(dialog);
  byId("wake-training-button", HTMLButtonElement).addEventListener("click", () => void openTraining(dialog));
  for (const stepButton of stepButtons(dialog)) {
    stepButton.addEventListener("click", () => void runStep(dialog, stepButton));
  }
}

async function openTraining(dialog: HTMLDialogElement): Promise<void> {
  showStatus("", "");
  dialog.showModal();
  await answer(dialog, STATUS_PATH, {});
}

async function runStep(dialog: HTMLDialogElement, stepButton: HTMLButtonElement): Promise<void> {
  const step = STEPS[stepButton.dataset.wakeStep ?? ""];
  if (!step) return;
  showStatus(step.doing, "is-working");
  await answer(dialog, step.path, step.body);
}

/** Under the steps; once the review closes, the counts are asked for again. */
function addReviewButton(dialog: HTMLDialogElement): void {
  const review = createWakeReview();
  const open = button(
    "Review recordings…",
    "ghost",
    () => void review.open(() => void answer(dialog, STATUS_PATH, {})),
  );
  open.dataset.wakeReview = "";
  const entry = el("div", { class: "wake-review-entry" }, el("span", { class: "muted" }, REVIEW_HINT), open);
  byId("wake-training-status", HTMLElement).before(entry);
}

async function showRecordingCount(dialog: HTMLDialogElement): Promise<void> {
  const count = (await fetchWakeRecordings().catch(() => [])).length;
  const open = dialog.querySelector<HTMLButtonElement>("button[data-wake-review]");
  if (open) open.textContent = `Review recordings (${count})…`;
}

/** Every step button waits for the answer: two recordings at once would talk over each other. */
async function answer(dialog: HTMLDialogElement, path: string, body: object): Promise<void> {
  disableSteps(dialog);
  try {
    showStatus((await post(path, body)) ?? "", "");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), "is-refused");
  } finally {
    await showRecordingCount(dialog);
    enableSteps(dialog);
  }
}

function disableSteps(dialog: HTMLDialogElement): void {
  for (const stepButton of stepButtons(dialog)) stepButton.disabled = true;
}

function enableSteps(dialog: HTMLDialogElement): void {
  for (const stepButton of stepButtons(dialog)) stepButton.disabled = false;
}

function stepButtons(dialog: HTMLDialogElement): HTMLButtonElement[] {
  return [...dialog.querySelectorAll<HTMLButtonElement>(STEP_BUTTONS)];
}

function showStatus(text: string, look: StatusLook): void {
  const status = byId("wake-training-status", HTMLElement);
  status.textContent = text;
  status.className = `wake-training-status ${look}`.trim();
}
