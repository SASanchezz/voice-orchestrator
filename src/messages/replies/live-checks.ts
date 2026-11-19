import type { SetupCheck } from "../../ui/reply-checkup-views.js";
import type { SourceHealth } from "./reply-health.js";

const RESTART = "Restart the app (⚙ › Restart): live feeds start with it.";

/** Whether the source's live feed runs, whether messages reached it, and whether drafts were made, since the start. */
export function liveChecks(health: SourceHealth, quietHint: string): SetupCheck[] {
  return [feedCheck(health), messagesCheck(health, quietHint), draftsCheck(health)];
}

/** Replies are off for the source: the feed doesn't run by design. */
export function sendCheck(isSending: boolean, configPlace: string): SetupCheck {
  if (isSending) return { label: "Replies turned on", status: "ok", detail: "send: true in config/config.yaml." };
  return {
    label: "Replies turned on",
    status: "warn",
    detail: "Off, so no messages are drafted here. Leave it off if you don't want replies from this messenger.",
    fix: `Add send: true ${configPlace} in config/config.yaml, then restart the app.`,
  };
}

function feedCheck({ feed, feedError }: SourceHealth): SetupCheck {
  const label = "Live feed";
  if (feed === "listening") return { label, status: "ok", detail: "Listening for new messages." };
  if (feed === "failed")
    return { label, status: "fail", detail: `It couldn't start: ${feedError ?? "unknown"}.`, fix: RESTART };
  return { label, status: "fail", detail: "Not started.", fix: RESTART };
}

function messagesCheck({ heard, passed, lastPassed }: SourceHealth, quietHint: string): SetupCheck {
  const label = "Messages received";
  if (passed)
    return {
      label,
      status: "ok",
      detail: `${passed} from people since the app started, the last at ${timeOf(lastPassed)}.`,
    };
  const events = heard ? ` The messenger sent ${heard} other events (your own messages, edits, bots).` : "";
  return { label, status: "warn", detail: `None from other people yet.${events}`, fix: quietHint };
}

function draftsCheck({ drafted, notNeeded, lastFailure }: SourceHealth): SetupCheck {
  const label = "Drafts";
  const made = `${drafted} drafted, ${notNeeded} needing no reply.`;
  if (lastFailure) return { label, status: "fail", detail: `${made} The last one failed: ${lastFailure}` };
  return { label, status: "ok", detail: made }; // none yet only follows from no messages, said above
}

function timeOf(at: Date | undefined): string {
  return at ? at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "an unknown time";
}
