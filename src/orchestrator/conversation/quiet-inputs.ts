import type { AppEvent } from "../../events/app-events.js";
import { describeEvent } from "./event-inputs.js";
import type { NoticeInput } from "./inputs.js";

/** Reminders of a quiet session's waiting requests aren't noted again and again while you are away. */
export function isWorthNoting(e: AppEvent): boolean {
  return !(e.kind === "permission" && e.reminder);
}

/** A quiet session's event is only noted for the model, never said: you may be asleep. */
export function quietInputFor(e: AppEvent): NoticeInput {
  return { kind: "notice", text: `[QUIET, not said aloud] ${describeEvent(e)}`, spoken: "" };
}
