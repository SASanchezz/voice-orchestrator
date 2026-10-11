import type { ContextReset } from "../lifecycle/context-reset.js";
import type { EventTurns } from "./event-turns.js";
import type { Input } from "./inputs.js";
import type { Notices } from "./notices.js";
import type { UserTurns } from "./user-turns.js";

/** Who handles each kind of input. */
export interface InputHandlers {
  user: UserTurns;
  event: EventTurns;
  notice: Notices;
  clear: ContextReset;
}

/** Hands each input to its handler. */
export class InputDispatcher {
  constructor(private handlers: InputHandlers) {}

  handle(input: Input): Promise<void> {
    if (input.kind === "user") return this.handlers.user.handle(input);
    if (input.kind === "event") return this.handlers.event.handle(input);
    if (input.kind === "notice") return this.handlers.notice.handle(input);
    return this.handlers.clear.clearWithHandoff(input);
  }
}
