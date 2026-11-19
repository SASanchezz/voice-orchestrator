// Writing in the open chat: what you type goes only when you press Send or ⌘↵. A source the app can't write in says
// why instead.

import { byId } from "./dom.js";
import { sendChatMessage, type ChatAddress } from "./chat-browse-api.js";

/** The open chat, and whether you can write in it. */
export interface WritableChat extends ChatAddress {
  canSend: boolean;
  sendHint: string;
}

let openChat: WritableChat | undefined;
let afterSend: () => Promise<void> = async () => {};

/** `sent` runs after each message goes, to show it in the chat. */
export function wireChatComposer(sent: () => Promise<void>): void {
  afterSend = sent;
  const form = byId("chat-composer", HTMLFormElement);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendWritten();
  });
  byId("chat-composer-input", HTMLTextAreaElement).addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) form.requestSubmit();
  });
}

export function showComposerFor(chat: WritableChat): void {
  openChat = chat;
  byId("chat-composer", HTMLFormElement).hidden = !chat.canSend;
  const hint = byId("chat-composer-hint", HTMLElement);
  hint.hidden = chat.canSend;
  hint.textContent = chat.sendHint;
  byId("chat-composer-input", HTMLTextAreaElement).value = "";
}

/** The text stays in the box when the messenger refuses it, so nothing you wrote is lost. */
async function sendWritten(): Promise<void> {
  const input = byId("chat-composer-input", HTMLTextAreaElement);
  const text = input.value.trim();
  if (!openChat || !text) return;
  try {
    await sendChatMessage(openChat, text);
    input.value = "";
    await afterSend();
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
  }
}
