// Whether this page is the window you are using. A page left visible behind another app still counts as visible, so
// focus is what tells that you moved to another app.

/** Focus moving into the Code view's editor and then to another app gives this page no blur, so it checks too. */
const FOCUS_CHECK_MS = 1000;

export function isPageInUse(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

/** `check` runs when the page gains or loses focus, and every second besides. */
export function wireFocusChecks(check: () => void): void {
  window.addEventListener("focus", check);
  window.addEventListener("blur", check);
  setInterval(check, FOCUS_CHECK_MS);
}
