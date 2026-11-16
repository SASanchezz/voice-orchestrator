// The notice panel's page: tasks that ended, to read instead of listen to, with a box to reply to their worker.
// Everything a worker or the model wrote is inserted as text, never as HTML.

import { onServerEvent, openEvents } from "../api.js";
import { byId } from "../dom.js";
import { wireImageViewer } from "../image-viewer.js";
import { store } from "../store.js";
import { AutoClose } from "./auto-close.js";
import { closeUntouched, markShownSeen, runCommand } from "./notice-commands.js";
import { BoxNews } from "../box-news.js";
import { addChatLine, box, chat, isBusy, pointer, render, reply } from "./notice-page.js";
import { commandOfKey, isNoticeCommand } from "./notice-shortcuts.js";
import { followPanelShowing, followPointer, reportHeight } from "./panel-bridge.js";
import { reportPageHidden, reportPageUse } from "../page-use-report.js";
import { wireProjectLinks } from "../project-links.js";
import { showShortcutChips } from "./shortcut-chips.js";

const autoClose = new AutoClose(isBusy, closeUntouched);
/** Saying "finish" sends the reply to the notice's session, wherever you were when you started. */
const news = new BoxNews(box, { describe: () => "", send: () => void reply.send() });
const replyInput = byId("reply-input", HTMLTextAreaElement);
const imageViewer = byId("image-viewer", HTMLDialogElement);

function connect(): void {
  const events = openEvents();
  onServerEvent(events, "state", (state) => store.receive(state));
  news.follow(events);
  onServerEvent(events, "chat", addChatLine);
  onServerEvent(events, "chat_cleared", (sessionId) => chat.clear(sessionId));
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
  if (imageViewer.open) return; // Esc closes the picture, not the notice under it
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
showShortcutChips();
wireClicks();
wireProjectLinks();
wireImageViewer();
wireReply(); // before wireKeys: Esc discards a recording before it closes anything
wireKeys();
followPointer(pointer);
followPanelShowing(reportPageUse, reportPageHidden); // shown, it takes your spoken words into its reply box
document.addEventListener("pointerdown", reportPageUse, { capture: true });
reportHeight(byId("notice-scroll", HTMLElement), byId("notice-body", HTMLElement));
connect();
