import type { QuietSessions } from "../../events/quiet-sessions.js";
import type { UserInput } from "./inputs.js";
import type { UserTurns } from "./user-turns.js";

/** Your words mean you are back: quiet sessions speak and pop up again, then your words are answered. */
export class WakingUserTurns {
  constructor(
    private turns: Pick<UserTurns, "handle">,
    private quiet: Pick<QuietSessions, "wake">,
  ) {}

  handle(input: UserInput): Promise<void> {
    this.quiet.wake();
    return this.turns.handle(input);
  }
}
