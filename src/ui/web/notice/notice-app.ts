// The notice panel's page: tasks that ended, to read instead of listen to, with a box to reply to their worker.
// Everything a worker or the model wrote is inserted as text, never as HTML.

import { onServerEvent, openEvents } from "../api.js";
import { byId } from "../dom.js";
import { store } from "../store.js";
import { AutoClose } from "./auto-close.js";
import { closeUntouched, markShownSeen, runCommand } from "./notice-commands.js";
import { box, isBusy, pointer, render } from "./notice-page.js";
import { commandOfKey, isNoticeCommand } from "./notice-shortcuts.js";
import { followPointer, reportHeight } from "./panel-bridge.js";

const autoClose = new AutoClose(isBusy, closeUntouched);
const replyInput = byId("reply-input", HTMLTextAreaElement);

function connect(): void {
  const events = openEvents();
  onServerEvent(events, "state", (state) => store.receive(state));
  onServerEvent(events, "dictation", (words) => box.showWords(words));
}

/** Buttons with a command run it; the mic and Send are wired with the reply box. */
function wireClicks(): void {
  document.addEventListener("click", (e) => {
    const button = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-command]") : null;
    const command = button?.dataset.command;
    if (isNoticeCommand(command)) runCommand(command);
  });
}

function wireKeys(): void {
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return; // Esc already discarded a recording
    const command = commandOfKey(e);
    if (command) {
      e.preventDefault();
      return runCommand(command);
    }
    if (e.key === "Escape") escape();
  });
}

/** Out of the reply box first, so Esc never closes a notice you are writing to. */
function escape(): void {
  if (document.activeElement === replyInput) return replyInput.blur();
  runCommand("close");
}

/** ↩ sends, ⇧↩ adds a line, as in the web UI's message box. */
function wireReply(): void {
  const form = byId("reply-form", HTMLFormElement);
  box.wire(form); // first: while recording, ↩ stops it instead
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runCommand("send");
  });
  replyInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.isComposing) return;
    e.preventDefault();
    runCommand("send");
  });
}

store.onChange(() => {
  render();
  autoClose.follow(store.state.notices);
});
document.addEventListener("pointerdown", markShownSeen, { capture: true });
document.addEventListener("keydown", markShownSeen, { capture: true });
wireClicks();
wireReply(); // before wireKeys: Esc discards a recording before it closes anything
wireKeys();
followPointer(pointer);
reportHeight(byId("notice-scroll", HTMLElement), byId("notice-body", HTMLElement));
connect();
