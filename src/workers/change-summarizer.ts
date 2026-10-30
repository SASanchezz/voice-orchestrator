import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";
import type { WorkerOptions } from "./worker-options.js";

const SUMMARY_MODEL = "haiku";
const MAX_TURNS = 4;
const GIT_TOOLS = ["Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git show:*)"];
const SYSTEM_PROMPT = "You explain code changes in a git repository by reading git output. You never change anything.";

/**
 * Spoken summary of the latest changes in a project, produced INSIDE the project's own account
 * (a fresh, cheap session that only reads git). Only this short text reaches the orchestrator,
 * so work code never passes through your personal account in raw form.
 * It doesn't resume the worker's session: copying a large context costs far more than reading the diff.
 */
export class ChangeSummarizer {
  constructor(
    private options: WorkerOptions,
    private query: QueryFn,
  ) {}

  async summarize(project: string, focus?: string): Promise<string> {
    const run = this.query({
      prompt: summaryPrompt(focus),
      options: {
        ...this.options.forProject(project),
        model: SUMMARY_MODEL,
        settingSources: [], // no CLAUDE.md or project MCP servers: git output is all it needs
        systemPrompt: SYSTEM_PROMPT,
        tools: ["Bash"],
        allowedTools: GIT_TOOLS,
        permissionMode: "dontAsk",
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
    `. Read them with git diff; if the working tree is clean, use the latest commit (git show --stat, then git show). ` +
    `No code, no markdown, mention file names only if essential.`
  );
}

async function summaryOf(run: Query): Promise<string> {
  let summary = "";
  for await (const msg of run)
    if (msg.type === "result") summary = msg.subtype === "success" ? msg.result : `Couldn't summarize: ${msg.subtype}`;
  return summary;
}
