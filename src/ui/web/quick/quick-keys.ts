// The quick panel's shortcuts, shown in its footer: ⌘K pick who gets it, ⌘1–⌘5 a recent session, ⌘0 the assistant,
// ⌘↩ send to a new session, Esc back out (the list first, then the panel), ⌘W close.

import { ASSISTANT_KEY, RECENT_COUNT } from "./quick-header.js";

export interface QuickKeyActions {
  togglePicker(): void;
  pickRecent(place: number): void;
  pickAssistant(): void;
  sendToNewSession(): void;
  escape(): void;
  close(): void;
}

const RECENT_KEYS = Array.from({ length: RECENT_COUNT }, (_, place) => String(place + 1));

/** After the box's own keys: a key a recording or the list already used is left alone. */
export function wireQuickKeys(actions: QuickKeyActions): void {
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const action = actionOf(e, actions);
    if (!action) return;
    e.preventDefault();
    action();
  });
}

function actionOf(e: KeyboardEvent, actions: QuickKeyActions): (() => void) | undefined {
  if (e.key === "Escape") return () => actions.escape();
  if (!e.metaKey) return undefined;
  return commandKeyAction(e.key.toLowerCase(), actions);
}

function commandKeyAction(key: string, actions: QuickKeyActions): (() => void) | undefined {
  if (key === "k") return () => actions.togglePicker();
  if (key === "enter") return () => actions.sendToNewSession();
  if (key === "w") return () => actions.close();
  if (key === ASSISTANT_KEY) return () => actions.pickAssistant();
  const place = RECENT_KEYS.indexOf(key);
  return place === -1 ? undefined : () => actions.pickRecent(place);
}
