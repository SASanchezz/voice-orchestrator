import { EventEmitter } from "node:events";
import type { InputSource } from "./inputs.js";

/** One line of the conversation, for the UI feed. */
export interface ConversationLine {
  role: "user" | "orchestrator";
  text: string;
  source?: InputSource;
}

/** The conversation as it happens, line by line. Emits "line" with each ConversationLine. */
export class ConversationLines extends EventEmitter {
  say(line: ConversationLine): void {
    this.emit("line", line);
  }
}
