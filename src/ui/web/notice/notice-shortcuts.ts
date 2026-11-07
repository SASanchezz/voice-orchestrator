// The notice panel's keyboard shortcuts, one table for both the keys and the hints shown on a button's long hover,
// so the two can't drift apart.

export type NoticeCommand =
  | "send"
  | "mic"
  | "close"
  | "closeAll"
  | "explain"
  | "fullNote"
  | "openAssistant"
  | "openSession"
  | "review"
  | "previous"
  | "next";

/** ⌘ and `key` (as KeyboardEvent.key has it, lower case), maybe with ⇧; `shown` is how a hint writes it. */
interface Shortcut {
  key: string;
  shift: boolean;
  shown: string;
}

const SHORTCUTS: Record<NoticeCommand, Shortcut> = {
  send: { key: "enter", shift: false, shown: "↩ or ⌘↩" },
  mic: { key: "d", shift: false, shown: "⌘D" },
  close: { key: "w", shift: false, shown: "⌘W or Esc" },
  closeAll: { key: "w", shift: true, shown: "⌘⇧W" },
  explain: { key: "e", shift: false, shown: "⌘E" },
  fullNote: { key: "f", shift: false, shown: "⌘F" },
  openAssistant: { key: "1", shift: false, shown: "⌘1" },
  openSession: { key: "2", shift: false, shown: "⌘2" },
  review: { key: "3", shift: false, shown: "⌘3" },
  previous: { key: "[", shift: false, shown: "⌘[" },
  next: { key: "]", shift: false, shown: "⌘]" },
};

const COMMANDS = Object.keys(SHORTCUTS).filter(isNoticeCommand);

/** The command a ⌘ key press stands for, if any; Esc and a plain ↩ in the reply box are handled where they apply. */
export function commandOfKey(e: KeyboardEvent): NoticeCommand | undefined {
  if (!e.metaKey || e.ctrlKey || e.altKey) return undefined;
  const key = e.key.toLowerCase();
  return COMMANDS.find((command) => SHORTCUTS[command].key === key && SHORTCUTS[command].shift === e.shiftKey);
}

/** "⌘2", for a button's hint. */
export function shortcutOf(command: NoticeCommand): string {
  return SHORTCUTS[command].shown;
}

export function isNoticeCommand(name: string | undefined): name is NoticeCommand {
  return name !== undefined && Object.hasOwn(SHORTCUTS, name);
}
