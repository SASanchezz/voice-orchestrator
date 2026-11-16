import type { Sessions } from "../registry/sessions.js";
import { requestsInScope, requestsMatching } from "./approval-match.js";
import type { PermissionAnswers } from "./permission-answers.js";
import type { Decision, Pending } from "./permission-types.js";
import { isSpokenApproval, readSpokenApproval, type SpokenApproval } from "./spoken-approval.js";
import type { WaitingRequests } from "./waiting-requests.js";

const NO_LONGER_WAITING = "That request is no longer waiting.";
const SPOKEN_OUTCOMES: Record<Decision, string> = { once: "Allowed", always: "Always allowed", deny: "Denied" };

/**
 * A message that is nothing but an approval ("allow", "deny", "allow commit"), answered in code the moment you say it,
 * whichever tab is in front. Matched to one request, a plain "allow" is enough even for a destructive one, as a click
 * is; that can only be allowed once.
 */
export class SpokenApprovals {
  constructor(
    private waiting: WaitingRequests,
    private answers: PermissionAnswers,
    private sessions: Sessions,
  ) {}

  /** True when `words` are a whole approval and some waiting request is one it can be about. */
  canAnswer(words: string): boolean {
    if (!isSpokenApproval(words)) return false;
    return requestsMatching(readSpokenApproval(words), this.waiting.all()).length > 0;
  }

  /**
   * Answers the request `words` are about and says what happened. Of several, the one asked first is answered, as
   * they are announced one at a time in the order they came.
   */
  answer(words: string, sessionInFront: string | undefined): string {
    const approval = readSpokenApproval(words);
    const matching = requestsMatching(approval, this.waiting.all());
    const [askedFirst] = requestsInScope(matching, sessionInFront);
    if (!askedFirst) return NO_LONGER_WAITING;
    return this.decide(askedFirst, approval);
  }

  private decide(pending: Pending, { decision }: SpokenApproval): string {
    const label = this.sessions.labelOf(pending.session);
    const verb = pending.destructive?.verb;
    if (verb && decision === "always")
      return `${label} wants to ${verb}, which can't be always allowed. Say "confirm" to allow it once.`;
    this.answers.answerBySpokenApproval(pending.id, decision);
    return `${SPOKEN_OUTCOMES[decision]}, ${label}.`;
  }
}
