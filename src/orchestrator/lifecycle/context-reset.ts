import type { ClearInput } from "../conversation/inputs.js";
import type { ConversationMemory } from "../memory/conversation-memory.js";
import type { OperatorSession } from "../model/operator-session.js";
import type { ResetMode, ResetRequests } from "./reset-requests.js";

const HANDOFF_REQUEST =
  "[SYSTEM] Context reset now. Write a handoff for your next session in at most 150 words: a short summary of what you and the user talked about, " +
  "key facts worth keeping, user decisions and preferences stated this session, promises you made (e.g. 'tell me when X finishes'), open questions. " +
  "Skip project statuses; those are tracked separately. Plain text.";

/** Starts the model's context over. Operational state lives in the registry, so nothing is lost. */
export class ContextReset {
  constructor(
    private session: OperatorSession,
    private memory: ConversationMemory,
    private requests: ResetRequests,
  ) {}

  async reset(mode: ResetMode): Promise<void> {
    this.requests.clearReset();
    this.memory.startOver(mode === "notes" ? await this.writeHandoff() : "");
    this.session.close();
    console.log(`[orchestrator] context reset (${mode === "notes" ? "with handoff" : "fresh"})`);
    this.session.start();
  }

  /** Saves the handoff (summary and key facts) to memory first; only then reports the conversation cleared. */
  async clearWithHandoff(request: ClearInput): Promise<void> {
    try {
      await this.reset("notes");
      request.saved();
    } catch (error) {
      request.failed(error);
    }
  }

  private writeHandoff(): Promise<string> {
    return this.session.ask(HANDOFF_REQUEST);
  }
}
