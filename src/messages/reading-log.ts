import { appendAgentLog } from "../orchestrator/model/agent-log.js";
import type { ReadingLog } from "./message-reading.js";

/** Each catch-up's counts, to the terminal and state/assistant-agent.jsonl; message text never goes to either. */
export class CountsLog implements ReadingLog {
  constructor(private file?: string) {}

  record(source: string, messages: number, chats: number): void {
    appendAgentLog({ at: new Date().toISOString(), event: "messages", source, messages, chats }, this.file);
    console.log(`[messages] ${source}: ${messages} messages, ${chats} chats`);
  }
}
