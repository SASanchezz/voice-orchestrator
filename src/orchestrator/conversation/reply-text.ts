/** Text after this in a reply is shown in the web UI and never spoken. */
export const SCREEN_MARKER = "[SCREEN]";

/** The part of a reply that is spoken: everything before [SCREEN]. */
export function spokenPart(reply: string): string {
  return reply.split(SCREEN_MARKER)[0].trim();
}

/** A reply as the web UI shows it: the spoken part, then the screen-only explanation. */
export function onScreen(reply: string): string {
  return reply
    .split(SCREEN_MARKER)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}
