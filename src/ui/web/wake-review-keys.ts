// The wake word review's keys: move through your recordings by ear, and tick the poor ones as you go.

export type ReviewCommand = "next" | "previous" | "replay" | "mark" | "switch-kind";

const COMMANDS: Record<string, ReviewCommand> = {
  ArrowDown: "next",
  j: "next",
  ArrowUp: "previous",
  k: "previous",
  " ": "replay",
  x: "mark",
  ArrowLeft: "switch-kind",
  ArrowRight: "switch-kind",
};

/** What a key press asks the review to do; a shortcut with ⌘, Ctrl or ⌥ is left to the browser. */
export function reviewCommandOf(event: KeyboardEvent): ReviewCommand | undefined {
  const hasModifier = event.metaKey || event.ctrlKey || event.altKey;
  return hasModifier ? undefined : COMMANDS[event.key];
}

export const KEYS_HINT = "↑ ↓ play next · Space play again · X tick · ← → switch tab";
