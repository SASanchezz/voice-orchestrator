import type { Orchestrator } from "../../orchestrator/orchestrator.js";
import type { Feed } from "../feed.js";
import { messageBody, speechModeBody } from "./request-body.js";

/** The assistant's chat and voice, from the page. */
export class AssistantActions {
  constructor(
    private orchestrator: Orchestrator,
    private feed: Feed,
  ) {}

  sendMessage(body: unknown): string {
    this.orchestrator.receiveTyped(messageBody.parse(body).text);
    return "Sent.";
  }

  /** The summary is saved before the visible chat goes, so nothing worth keeping is lost if saving fails. */
  async clearAssistant(): Promise<string> {
    await this.orchestrator.clearConversation();
    this.feed.clear();
    return "Assistant chat cleared; a short summary is kept.";
  }

  setSpeechMode(body: unknown): string {
    const { mode } = speechModeBody.parse(body);
    this.orchestrator.setSpeechMode(mode);
    return `Speech: ${mode}.`;
  }
}
