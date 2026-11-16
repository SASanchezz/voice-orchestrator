// Chrome takes an Escape the page leaves unhandled as "leave full screen", so pressing Escape to cancel a recording
// (which the hotkey helper catches system-wide) also dropped the window out of full screen. The page claims every
// Escape for itself, except in an open dialog, where Escape closes the dialog.

import { isDialogOpen } from "./dom.js";

/** Wired after the page's other Escape handlers, which skip an Escape already claimed. */
export function wireFullScreenEscape(): void {
  document.addEventListener("keydown", claimEscape);
}

function claimEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || isDialogOpen()) return;
  event.preventDefault();
}
