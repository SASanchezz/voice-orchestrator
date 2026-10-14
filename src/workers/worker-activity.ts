import type { Sessions } from "../registry/sessions.js";
import { toolInput } from "../safety/tool-calls.js";
import { asText } from "../shared/text.js";
import type { SessionMessage, WorkerChat } from "./worker-chat.js";

const DETAIL_CHARS = 80;

/** The parts of an assistant message block the chat uses. */
interface ContentBlock {
  type: string;
  id?: string;
  text?: string;
  name?: string;
  input?: unknown;
}

/**
 * The worker's words go to the session's chat; its tool calls also become its current activity.
 * A sub-agent's lines carry the id of the tool call that started it, so the page nests them under it.
 */
export class WorkerActivity {
  constructor(
    private sessions: Sessions,
    private chat: WorkerChat,
  ) {}

  record(sessionId: string, content: readonly ContentBlock[], parentToolUseId?: string): void {
    const line = { session: sessionId, parentToolUseId };
    for (const block of content) {
      if (block.type === "text" && block.text?.trim())
        this.chat.post({ ...line, kind: "reply", text: block.text.trim() });
      if (block.type === "tool_use" && block.name) this.recordStep({ ...line, ...stepLineOf(block, block.name) });
    }
  }

  private recordStep(step: SessionMessage): void {
    this.sessions.updateSession(step.session, { lastActivity: step.text });
    this.chat.post(step);
  }
}

function stepLineOf(block: ContentBlock, toolName: string): Pick<SessionMessage, "kind" | "text" | "toolUseId"> {
  return { kind: "tool", text: stepOf(toolName, block.input), toolUseId: block.id };
}

/** "Bash npm test", "Edit src/app.ts" or "Agent Review the diff": the tool and what it works on. */
function stepOf(toolName: string, rawInput: unknown): string {
  const input = toolInput(rawInput);
  const detail =
    toolName === "Bash"
      ? asText(input.command ?? "").slice(0, DETAIL_CHARS)
      : asText(input.file_path ?? input.description ?? "");
  return `${toolName} ${detail}`.trim();
}
