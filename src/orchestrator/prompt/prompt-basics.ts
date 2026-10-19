import type { AppConfig } from "../../config/app-config.js";
import type { AssistantNotes } from "../memory/assistant-notes.js";
import { SYSTEM_PROMPT } from "./system-prompt-text.js";
import { TODO_PROMPT } from "./todo-prompt-text.js";

/** The parts of the system prompt that set up the operator: how it works, your rules and notes, today, the names it knows. */
export class PromptBasics {
  constructor(
    private cfg: AppConfig,
    private notes: AssistantNotes,
  ) {}

  parts(): string[] {
    const notes = this.notes.read();
    return [
      SYSTEM_PROMPT,
      TODO_PROMPT,
      this.standingRules(),
      notes && `The user's notes (follow them like the standing rules):\n${notes}`,
      `Now: ${new Date().toString()}.`, // for calendar events; your custom prompt replaces Claude Code's own date line
      `Projects: ${Object.keys(this.cfg.projects).join(", ")}. Accounts: ${Object.keys(this.cfg.profiles).join(", ")}.`,
    ].filter(Boolean);
  }

  private standingRules(): string {
    const { rules } = this.cfg.orchestrator;
    if (!rules.length) return "";
    const list = rules.map((r) => `- ${r}`).join("\n");
    return `The user's standing rules (follow them, except where they conflict with the destructive-action rules):\n${list}`;
  }
}
