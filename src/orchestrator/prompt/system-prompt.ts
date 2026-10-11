import type { ConversationMemory } from "../memory/conversation-memory.js";
import type { ProjectSituation } from "./project-situation.js";
import type { PromptBasics } from "./prompt-basics.js";

/** The operator's system prompt, written fresh for every new session so it starts from the current state. */
export class SystemPrompt {
  constructor(
    private basics: PromptBasics,
    private situation: ProjectSituation,
    private memory: ConversationMemory,
  ) {}

  text(): string {
    return [...this.basics.parts(), ...this.situation.parts(), this.memory.recap()].filter(Boolean).join("\n\n");
  }
}
