// The buttons that take you somewhere show their ⌘ key beside their words, so the shortcuts are learned by looking.
// The keys come from the same table the shortcuts run from, so the two can't drift apart.

import { isNoticeCommand, shortcutOf } from "./notice-shortcuts.js";

const CHIPPED = ".notice-open-group [data-command], #notice-explain";

export function showShortcutChips(): void {
  for (const button of document.querySelectorAll<HTMLElement>(CHIPPED)) {
    const command = button.dataset.command;
    if (isNoticeCommand(command)) button.dataset.chip = shortcutOf(command);
  }
}
