// While a message box records, the words heard rewrite it every second or so, so it can't take your edits. Starting
// to edit (a key that changes the text or moves the caret, or a click into the box) stops the recording first, as ■
// does: the final words land and the box is yours, with the caret where you put it. The key that stopped it is
// swallowed, since the words it would act on are about to change.

import type { DictationBox } from "./dictation-box.js";

const CARET_KEYS = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
const EDITING_SHORTCUT_KEYS = new Set(["v", "x", "z"]);

export function wireStopOnEdit(box: DictationBox, input: HTMLTextAreaElement): void {
  input.addEventListener("keydown", (e) => stopOnEditingKey(box, input, e));
  input.addEventListener("click", () => void stopKeepingCaret(box, input));
}

function stopOnEditingKey(box: DictationBox, input: HTMLTextAreaElement, e: KeyboardEvent): void {
  if (!box.isRecording() || !isEditingKey(e)) return;
  e.preventDefault();
  void stopKeepingCaret(box, input);
}

/** Copy, select all and the page's own shortcuts leave the recording running. */
function isEditingKey(e: KeyboardEvent): boolean {
  if (CARET_KEYS.has(e.key)) return true;
  const isShortcut = e.metaKey || e.ctrlKey;
  if (isShortcut) return EDITING_SHORTCUT_KEYS.has(e.key.toLowerCase());
  return isPrintable(e.key);
}

function isPrintable(key: string): boolean {
  return key.length === 1;
}

async function stopKeepingCaret(box: DictationBox, input: HTMLTextAreaElement): Promise<void> {
  if (!box.isRecording()) return;
  const { selectionStart, selectionEnd } = input;
  await box.finish();
  input.setSelectionRange(selectionStart, selectionEnd);
}
