import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";
import type { WorkerDirectory } from "./worker-directory.js";
import type { WorkerOptions } from "./worker-options.js";

const MAX_TURNS = 8;
const READ_ONLY_TOOLS = ["Read", "Grep", "Glob", "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)"];

/**
 * Spoken summary of the latest changes in the project's active session, produced INSIDE the project's own account
 * (a read-only fork of its session). Only this short text reaches the orchestrator,
 * so work code never passes through your personal account in raw form.
 */
export class ChangeSummarizer {
  constructor(
    private options: WorkerOptions,
    private directory: WorkerDirectory,
    private query: QueryFn,
  ) {}

  async summarize(project: string, focus?: string): Promise<string> {
    const session = this.directory.activeSession(project);
    const run = this.query({
      prompt: summaryPrompt(focus),
      options: {
        ...this.options.forProject(project),
        resume: session.claudeSessionId,
        forkSession: true, // don't pollute the worker's own session
        permissionMode: "dontAsk",
        allowedTools: READ_ONLY_TOOLS,
        maxTurns: MAX_TURNS,
      },
    });
    return (await summaryOf(run)) || "No summary available.";
  }
}

function summaryPrompt(focus: string | undefined): string {
  return (
    `In 3-4 sentences meant to be spoken aloud, explain the implementation of the latest changes` +
    (focus ? ` with focus on: ${focus}` : "") +
    `. Use git status/diff if useful. No code, no markdown, mention file names only if essential.`
  );
}

async function summaryOf(run: Query): Promise<string> {
  let summary = "";
  for await (const msg of run)
    if (msg.type === "result") summary = msg.subtype === "success" ? msg.result : `Couldn't summarize: ${msg.subtype}`;
  return summary;
}
