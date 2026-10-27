import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { logTiming } from "../../shared/timing.js";

export type AssistantContent = Extract<SDKMessage, { type: "assistant" }>["message"]["content"];

/** Logs where a turn's time goes: each tool the model asks for, its first words, and the whole turn. */
export class TurnTimeline {
  private startedAt = Date.now();
  private hasWritten = false;

  turnStarted(): void {
    this.startedAt = Date.now();
    this.hasWritten = false;
  }

  receive(msg: SDKMessage): void {
    if (msg.type === "assistant") this.modelWrote(msg.message.content);
    if (msg.type === "result") this.turnEnded(msg.num_turns);
  }

  modelWrote(content: AssistantContent): void {
    for (const block of content) {
      if (block.type === "tool_use") logTiming(`model asked for ${block.name}`, this.startedAt);
      if (block.type === "text" && !this.hasWritten) this.firstWords();
    }
  }

  turnEnded(modelCalls: number): void {
    logTiming(`turn done after ${modelCalls} model calls`, this.startedAt);
  }

  private firstWords(): void {
    this.hasWritten = true;
    logTiming("model's first words", this.startedAt);
  }
}
