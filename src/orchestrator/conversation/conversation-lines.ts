import { EventEmitter } from "node:events";
import type { SessionLink } from "../../events/app-events.js";
import type { InputSource } from "./inputs.js";

/** One line of the conversation, for the UI feed. */
export interface ConversationLine {
  role: "user" | "orchestrator";
  text: string;
  source?: InputSource;
  /** The worker session whose answer this line relays. */
  session?: SessionLink;
}

/** The conversation as it happens, line by line. Emits "line" with each ConversationLine. */
export class ConversationLines extends EventEmitter {
  say(line: ConversationLine): void {
    this.emit("line", line);
  }
}
