import type { Sessions } from "../registry/sessions.js";
import { toolInput } from "../safety/tool-calls.js";
import { asText } from "../shared/text.js";
import type { WorkerChat } from "./worker-chat.js";

const DETAIL_CHARS = 80;

/** The parts of an assistant message block the chat uses. */
interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

/** The worker's words go to the session's chat; its tool calls also become its current activity. */
export class WorkerActivity {
  constructor(
    private sessions: Sessions,
    private chat: WorkerChat,
  ) {}

  record(sessionId: string, content: readonly ContentBlock[]): void {
    for (const block of content) {
      if (block.type === "text" && block.text?.trim()) this.chat.say(sessionId, "reply", block.text.trim());
      if (block.type === "tool_use" && block.name) this.recordStep(sessionId, stepOf(block.name, block.input));
    }
  }

  private recordStep(sessionId: string, activity: string): void {
    this.sessions.updateSession(sessionId, { lastActivity: activity });
    this.chat.say(sessionId, "tool", activity);
  }
}

/** "Bash npm test" or "Edit src/app.ts": the tool and what it works on. */
function stepOf(toolName: string, rawInput: unknown): string {
  const input = toolInput(rawInput);
  const detail =
    toolName === "Bash" ? asText(input.command ?? "").slice(0, DETAIL_CHARS) : asText(input.file_path ?? "");
  return `${toolName} ${detail}`.trim();
}
