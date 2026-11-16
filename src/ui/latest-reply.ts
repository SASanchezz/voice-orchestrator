import type { ConversationLine, ConversationLines } from "../orchestrator/conversation/conversation-lines.js";

/** The assistant's reply since your last words, which a reply streamed in pieces adds to. */
export class LatestReply {
  private reply = "";

  follow(lines: ConversationLines): void {
    lines.on("line", (line: ConversationLine) => this.remember(line));
  }

  get text(): string {
    return this.reply;
  }

  private remember({ role, text }: ConversationLine): void {
    if (role === "user") this.reply = "";
    else this.reply = [this.reply, text].filter(Boolean).join("\n\n");
  }
}
