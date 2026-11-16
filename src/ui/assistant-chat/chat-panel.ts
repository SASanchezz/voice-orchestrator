import type { ConversationLine } from "../../orchestrator/conversation/conversation-lines.js";

/** One message in the chat pop-up: yours or the assistant's. */
export type ChatLine = Pick<ConversationLine, "role" | "text">;

/** What the chat pop-up shows: its title, the recent dialogue oldest first, and whether Deny and Approve are offered. */
export interface ChatView {
  title: string;
  offersApproval: boolean;
  lines: ChatLine[];
}

/** The open chat pop-up: it shows a new view or comes to the front; only you close it. */
export interface ChatPanel {
  update(view: ChatView): void;
  raise(): void;
}

/**
 * What happens in the chat pop-up: a click or a message ("yes", "cancel", "text:<your words>"), your first click
 * anywhere in it since it last came up, and its closing.
 */
export interface ChatPanelEvents {
  chosen(answer: string): void;
  seen(): void;
  closed(): void;
}

/** Opens native chat pop-ups, which stay open until you close them. */
export interface ChatPanelDevice {
  open(events: ChatPanelEvents): ChatPanel;
}
