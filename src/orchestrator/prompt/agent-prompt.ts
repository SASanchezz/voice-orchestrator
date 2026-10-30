import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { AssistantAgent } from "../../config/assistant-agent.js";
import type { SystemPrompt } from "./system-prompt.js";

/** The assistant as its specialized agent: the operator's system prompt, then the agent's own rules. */
export class AgentPrompt {
  constructor(
    private agent: AssistantAgent,
    private prompt: SystemPrompt,
  ) {}

  get name(): string {
    return this.agent.name;
  }

  /** Written fresh for every new session, like the system prompt; it inherits the session's tools and model. */
  definition(): AgentDefinition {
    return { description: this.agent.description, prompt: this.text(), model: "inherit" };
  }

  private text(): string {
    return `${this.prompt.text()}\n\nYou are the "${this.agent.name}" agent.\n\n${this.agent.instructions}`;
  }
}
