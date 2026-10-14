/** Asked of the old session (a fork of it, so it isn't changed) to write what a fresh one needs. */
export const HANDOFF_REQUEST =
  "This session is being handed off to a fresh one because its context is large. Write a handoff summary for the " +
  "new session, which won't see this conversation: the goal, what is done, the current state (changed files, " +
  "anything uncommitted, test status), open problems and decisions, and the next steps. Markdown, at most 300 words. " +
  "Don't use tools.";

/** The new session's first task starts with the summary it took over. */
export function withHandoff(instruction: string, handoff: string | undefined): string {
  if (!handoff) return instruction;
  return `This session continues earlier work. Handoff summary from the previous session:\n\n${handoff}\n\nYour task:\n${instruction}`;
}
