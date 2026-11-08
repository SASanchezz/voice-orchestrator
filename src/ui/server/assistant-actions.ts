import type { ClickedWords } from "../../orchestrator/conversation/clicked-words.js";
import type { Orchestrator } from "../../orchestrator/orchestrator.js";
import type { Feed } from "../feed.js";
import { clickedWordsBody, speechModeBody } from "./request-body.js";

const SENT = "Sent.";

/** The assistant's chat and voice, from the page. */
export class AssistantActions {
  constructor(
    private orchestrator: Orchestrator,
    private feed: Feed,
    private clickedWords: ClickedWords,
  ) {}

  sendMessage(text: string): string {
    this.orchestrator.receiveTyped(text);
    return SENT;
  }

  /** A Confirm or Cancel click: the reply being said stops first. */
  sendClickedWords(body: unknown): string {
    this.clickedWords.receiveTyped(clickedWordsBody.parse(body).text);
    return SENT;
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
