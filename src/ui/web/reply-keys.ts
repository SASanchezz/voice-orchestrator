// Moving through the Messages view without the mouse: ↓ or J and ↑ or K pick the next or previous reply, E edits it.
// Keys typed into a box, with a modifier, or while a dialog is open are left alone.

import { isDialogOpen } from "./dom.js";
import { store } from "./store.js";

const STEPS: Record<string, number> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 };
const EDIT_KEY = "e";

export interface ReplyKeyActions {
  move(step: number): void;
  edit(): void;
}

export function wireReplyKeys(actions: ReplyKeyActions): void {
  document.addEventListener("keydown", (key) => {
    if (!isListKey(key)) return;
    const step = STEPS[key.key];
    if (step) actions.move(step);
    else if (key.key === EDIT_KEY) actions.edit();
    else return;
    key.preventDefault();
  });
}

function isListKey(key: KeyboardEvent): boolean {
  const isModified = key.metaKey || key.ctrlKey || key.altKey;
  return store.messagesShown && !isModified && !isTyping(key.target) && !isDialogOpen();
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
}
