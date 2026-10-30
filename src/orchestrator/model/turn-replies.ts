import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentTurnLog } from "./agent-turn-log.js";
import type { TurnTimeline } from "./turn-timeline.js";

type OnText = (text: string) => void;

/** Collects the model's reply to the current turn, piece by piece, and hands it over when the turn ends. */
export class TurnReplies {
  private text = "";
  private onText?: OnText;
  private resolve?: (reply: string) => void;

  constructor(
    private timeline: TurnTimeline,
    private agentTurns: AgentTurnLog,
  ) {}

  /**
   * The next turn's whole reply; `onText` hears each piece as the model writes it, before its tool calls run.
   * A reply that wasn't streamed (e.g. the crash notice) reaches `onText` whole, just before the turn resolves.
   */
  expect(onText?: OnText): Promise<string> {
    this.timeline.turnStarted();
    let streamed = false;
    this.onText = (piece) => {
      streamed = true;
      onText?.(piece);
    };
    return new Promise((resolve) => {
      this.resolve = (reply) => {
        if (!streamed && reply) onText?.(reply);
        resolve(reply);
      };
    });
  }

  receive(msg: SDKMessage): void {
    this.timeline.receive(msg);
    this.agentTurns.receive(msg);
    if (msg.type === "assistant")
      for (const block of msg.message.content) if (block.type === "text") this.receiveText(block.text);
    if (msg.type === "result") this.finish(this.text.trim() || (msg.subtype === "success" ? msg.result : ""));
  }

  /** The session died mid-turn: the turn ends with this notice instead. */
  crashed(notice: string): void {
    this.resolve?.(notice);
  }

  private receiveText(text: string): void {
    this.text += text + " ";
    if (text.trim()) this.onText?.(text.trim());
  }

  private finish(reply: string): void {
    this.text = "";
    this.resolve?.(reply);
  }
}
