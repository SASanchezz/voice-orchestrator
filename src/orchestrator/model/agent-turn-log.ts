import { appendAgentLog, type HandledBy } from "./agent-log.js";

/** What the log reads from the session's messages (an SDKMessage fits it): the turn's start and its end. */
export interface TurnMessage {
  type: string;
  subtype?: string;
  /** On the start-of-turn ("init") message: the agents the session loaded. */
  agents?: string[];
}

/** How a turn run without the specialized agent is named in the log. */
const FALLBACK_AGENT = "claude";

/**
 * Logs which agent handled every assistant turn. The session's start-of-turn message lists the agents it loaded; a
 * turn whose list lacks the specialized one ran as plain Claude, and that is logged as an error. Each turn goes to the
 * terminal and to state/assistant-agent.jsonl, with its time.
 */
export class AgentTurnLog {
  private handledBy: HandledBy = "fallback";

  constructor(
    private agentName: string,
    private file?: string,
  ) {}

  receive(msg: TurnMessage): void {
    if (msg.type === "system" && msg.subtype === "init") this.handledBy = this.handledByOf(msg.agents ?? []);
    if (msg.type === "result") this.turnEnded();
  }

  private handledByOf(loadedAgents: string[]): HandledBy {
    return loadedAgents.includes(this.agentName) ? "specialized" : "fallback";
  }

  private turnEnded(): void {
    const at = new Date().toISOString();
    const agent = this.handledBy === "specialized" ? this.agentName : FALLBACK_AGENT;
    appendAgentLog({ at, event: "turn", agent, handledBy: this.handledBy }, this.file);
    if (this.handledBy === "specialized") console.log(`[agent] ${at} turn handled by ${agent} (specialized)`);
    else console.error(`[agent] ${at} turn handled by ${agent} (FALLBACK: ${this.agentName} was not loaded)`);
  }
}
