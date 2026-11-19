import type { VoiceApprovals } from "./approval-voice.js";

/** Several kinds of whole-message answers in turn: the first that can answer does. */
export class VoiceAnswerChain implements VoiceApprovals {
  constructor(private answerers: VoiceApprovals[]) {}

  canAnswer(words: string): boolean {
    return this.answerers.some((answerer) => answerer.canAnswer(words));
  }

  answer(words: string, sessionInFront: string | undefined): string {
    const answerer = this.answerers.find((candidate) => candidate.canAnswer(words));
    if (!answerer) throw new Error(`Nothing answers "${words}"; ask canAnswer first.`);
    return answerer.answer(words, sessionInFront);
  }
}
