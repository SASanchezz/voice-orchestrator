import { Api } from "telegram";
import type { Dialog } from "telegram/tl/custom/dialog.js";
import type { TelegramChatKind } from "./telegram-port.js";

const YOU = "You";
const SOMEONE = "someone";

export function chatKind(dialog: Dialog): TelegramChatKind {
  if (dialog.isUser) return dialog.entity instanceof Api.User && dialog.entity.bot ? "bot" : "private";
  return dialog.isGroup ? "group" : "channel";
}

/** "You" for your own messages; otherwise the person's name, or the channel's title. */
export function senderName(message: Api.Message): string {
  if (message.out) return YOU;
  const sender = message.sender;
  if (sender instanceof Api.User) return personName(sender);
  if (sender instanceof Api.Channel || sender instanceof Api.Chat) return sender.title;
  return SOMEONE;
}

function personName(user: Api.User): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.username || SOMEONE;
}
