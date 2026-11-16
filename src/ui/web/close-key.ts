// In the installed app's window Chrome takes a Cmd+W the page leaves unclaimed as "close the window", so pressing it to
// close a VS Code tab while the focus sat outside VS Code closed the whole Orchestrator. The page claims every Cmd+W:
// inside a VS Code frame, VS Code closes its tab as usual; elsewhere, the key goes on to the shown VS Code, if any.

const SHOWN_EDITOR_FRAME = "iframe.code-frame:not([hidden])";
const CLOSE_KEY: KeyboardEventInit = {
  key: "w",
  code: "KeyW",
  keyCode: 87,
  metaKey: true,
  bubbles: true,
  cancelable: true,
};

export function wireCloseKey(): void {
  window.addEventListener("keydown", passCloseKeyToEditor, { capture: true });
}

/** VS Code ignores whether a key was already claimed, so claiming it first still lets VS Code close its tab. */
export function claimCloseKeyIn(frame: HTMLIFrameElement): void {
  frame.addEventListener("load", () =>
    frame.contentWindow?.addEventListener("keydown", claimCloseKey, { capture: true }),
  );
}

function passCloseKeyToEditor(event: KeyboardEvent): void {
  if (!isCloseKey(event)) return;
  event.preventDefault();
  const frame = document.querySelector<HTMLIFrameElement>(SHOWN_EDITOR_FRAME);
  const editorPage = frame?.contentDocument;
  if (!editorPage) return;
  const focused = editorPage.activeElement ?? editorPage.body;
  focused.dispatchEvent(new KeyboardEvent("keydown", CLOSE_KEY));
}

function claimCloseKey(event: KeyboardEvent): void {
  if (isCloseKey(event)) event.preventDefault();
}

function isCloseKey(event: KeyboardEvent): boolean {
  const hasOnlyCommand = event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
  return event.code === "KeyW" && hasOnlyCommand;
}
