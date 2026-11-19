// What the Messages view shows of drafted Slack and Telegram replies. No imports, so the page bundles it.

/** A reply waiting for you: where it goes, why it was drafted, and its text. */
export interface ReplyDraftView {
  id: string;
  /** e.g. "Slack acme" or "Telegram". */
  source: string;
  chatName: string;
  from: string;
  chatKind: "dm" | "group-dm" | "group";
  /** chat, question, request, code-question or fyi. */
  kind: string;
  urgency: "low" | "normal" | "high";
  text: string;
  createdAt: string;
}

/** One line of the conversation a draft answers, read from the messenger when you open it and never stored. */
export interface ReplyContextLine {
  from: string;
  text: string;
  sentAt: string;
}

/** Whether new messages get drafted replies, as the Drafting switch shows it. */
export interface DraftingView {
  on: boolean;
}
