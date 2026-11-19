import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import type { ClosedConversation, ClosedConversations } from "../../workers/closed-conversations.js";
import { reopenedReport, type SessionReopener } from "../../workers/session-reopener.js";
import { defineTool, needProject, projectArg, text, type OperatorTool } from "./tool-kit.js";

const closedNumberArg = z
  .number()
  .int()
  .positive()
  .describe("The closed session's number in list_closed_sessions' list; 1 is the latest");

export function listClosedSessions(closed: ClosedConversations, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "list_closed_sessions",
    description: "A project's recently closed sessions that reopen_session can bring back, latest first, numbered.",
    args: { project: projectArg },
    run: async ({ project }) => {
      const name = needProject(cfg, project);
      return text(closedList(name, await closed.list(name)));
    },
  });
}

function closedList(project: string, conversations: ClosedConversation[]): string {
  if (!conversations.length) return `${project} has no closed sessions to reopen.`;
  const lines = conversations.map((conversation, index) => `${index + 1}. ${closedLine(conversation)}`);
  return `${project}'s closed sessions, latest first:\n${lines.join("\n")}`;
}

function closedLine({ title, lastActive }: ClosedConversation): string {
  return `${title} (last active ${lastActive.toLocaleString("en-GB")})`;
}

export function reopenSession(closed: ClosedConversations, reopener: SessionReopener, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "reopen_session",
    description:
      "Revert closing a session: brings a closed session back as a new active session whose next task continues " +
      "its worker's conversation. Leave the number out for the latest closed one.",
    args: { project: projectArg, closed: closedNumberArg.optional() },
    run: async ({ project, closed: number = 1 }) => {
      const name = needProject(cfg, project);
      const conversation = pickClosed(name, await closed.list(name), number);
      return text(reopenedReport(conversation, await reopener.reopen(name, conversation)));
    },
  });
}

function pickClosed(project: string, conversations: ClosedConversation[], number: number): ClosedConversation {
  const conversation = conversations.at(number - 1);
  if (!conversation) throw new Error(`${project} has no closed session ${number}; it has ${conversations.length}.`);
  return conversation;
}
