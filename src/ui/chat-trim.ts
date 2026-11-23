import type { ChatMessage } from "./chat-files.js";

/**
 * The chat cut down to `limit` lines. Tool steps go first, oldest first, because a busy worker
 * (or its subagents) can log hundreds of them in minutes and would otherwise push out the task,
 * the replies and the questions that give the chat its meaning. Only when those alone exceed
 * the limit are the oldest of them dropped too.
 */
export function trimChat(messages: ChatMessage[], limit: number): ChatMessage[] {
  const excess = messages.length - limit;
  if (excess <= 0) return messages;
  const droppedSteps = new Set(oldestSteps(messages, excess));
  const kept = messages.filter((message) => !droppedSteps.has(message));
  return kept.slice(-limit);
}

function oldestSteps(messages: ChatMessage[], count: number): ChatMessage[] {
  return messages.filter(isStep).slice(0, count);
}

function isStep(message: ChatMessage): boolean {
  return message.kind === "tool";
}
