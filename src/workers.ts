import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { query as sdkQuery, type HookCallback, type Options } from "@anthropic-ai/claude-agent-sdk";

export type QueryFn = typeof sdkQuery;
import { AppConfig, envForProfile } from "./config.js";
import { Registry } from "./registry.js";
import { PermissionBroker } from "./permissions.js";
import { DestructiveList } from "./destructive.js";
import type { ChatKind, SessionMessage } from "./chats.js";
import { detectUsageLimit, type UsageLimits } from "./usage-limit.js";
import type { SavedTodo } from "./todo.js";

/** The parts of an assistant message block the chat uses. */
interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** A session's worker while it works through its queue. */
interface ActiveRun {
  abort: AbortController;
  finished: Promise<void>;
}

/**
 * Headless Claude Code sessions, several per project if you open them, each resumed across instructions.
 * Each project runs under its own account via CLAUDE_CONFIG_DIR.
 * Methods taking a project act on its active session.
 * Emits "message" with each line a session adds to its chat.
 */
export class WorkerManager extends EventEmitter {
  private runs = new Map<string, ActiveRun>();

  constructor(
    private cfg: AppConfig,
    private registry: Registry,
    private broker: PermissionBroker,
    private destructive: DestructiveList,
    private limits: UsageLimits,
    private query: QueryFn = sdkQuery,
  ) {
    super();
  }

  /** Tasks saved to the todo list because their account hit a usage limit, oldest first. */
  savedTasks(): SavedTodo[] {
    return this.limits.saved();
  }

  /** Runs a saved task in its project's active session and takes it off the todo list. */
  runSavedTask(id: string): string {
    const saved = this.limits.find(id);
    if (!this.cfg.projects[saved.project]) throw new Error(`Project ${saved.project} is no longer known; todo task ${id} kept.`);
    if (!existsSync(this.cfg.projects[saved.project].path)) throw new Error(`Folder for ${saved.project} not found; todo task ${id} kept.`);
    this.limits.endEpisode(saved.account); // a new limit failure is announced again
    const started = this.run(saved.project, saved.task);
    this.limits.discard(id);
    return started;
  }

  discardSavedTask(id: string): string {
    const saved = this.limits.find(id);
    this.limits.discard(id);
    return `Removed todo task ${id} (${saved.project}).`;
  }

  /** Start a task in the project's active session, or queue it if that session is busy. */
  run(project: string, instruction: string): string {
    return this.runInSession(this.registry.activeSession(project).id, instruction);
  }

  runInSession(sessionId: string, instruction: string): string {
    const session = this.registry.session(sessionId);
    const label = this.registry.labelOf(sessionId);
    const { path } = this.cfg.projects[session.project];
    if (!existsSync(path)) return `Folder for ${session.project} not found: ${path}`;
    this.say(sessionId, "task", instruction);
    if (this.runs.has(sessionId)) {
      const queued = [...session.queued, instruction];
      this.registry.updateSession(sessionId, { queued });
      this.say(sessionId, "status", `Queued as #${queued.length}.`);
      return `${label} is busy; queued as #${queued.length}.`;
    }
    const abort = new AbortController();
    this.runs.set(sessionId, { abort, finished: this.loop(sessionId, instruction, abort) });
    return `Started on ${label} (${this.registry.get(session.project).profile} account).`;
  }

  /** Whether any of the project's sessions is working. */
  isBusy(project: string): boolean {
    return this.registry.sessionsOf(project).some((s) => this.runs.has(s.id));
  }

  stop(project: string): string {
    return this.stopSession(this.registry.activeSession(project).id);
  }

  stopSession(sessionId: string): string {
    const label = this.registry.labelOf(sessionId);
    const run = this.runs.get(sessionId);
    if (!run) return `${label} is not running.`;
    this.registry.updateSession(sessionId, { queued: [] });
    run.abort.abort();
    return `Stopping ${label}; its queue was cleared.`;
  }

  stopAll() {
    for (const sessionId of this.runs.keys()) this.stopSession(sessionId);
  }

  /** Stops the session's worker, waits for it to exit, then forgets the session entirely. */
  async closeSession(sessionId: string): Promise<string> {
    const label = this.registry.labelOf(sessionId);
    await this.stopAndWait(sessionId);
    this.registry.removeSession(sessionId);
    return `Closed ${label}; its worker, queue and history are gone.`;
  }

  /** Stops the session's worker, then wipes its chat, history and conversation; the session stays open. */
  async clearSession(sessionId: string): Promise<string> {
    const label = this.registry.labelOf(sessionId);
    await this.stopAndWait(sessionId);
    this.registry.clearSession(sessionId);
    return `Cleared ${label}; its next task starts a fresh conversation.`;
  }

  private async stopAndWait(sessionId: string) {
    const run = this.runs.get(sessionId);
    if (!run) return;
    this.stopSession(sessionId);
    await run.finished;
  }

  private async loop(sessionId: string, first: string, abort: AbortController) {
    let next: string | undefined = first;
    try {
      while (next) {
        await this.runOne(sessionId, next, abort);
        const session = this.registry.session(sessionId);
        next = session.status === "done" ? session.queued[0] : undefined;
        if (next) this.registry.updateSession(sessionId, { queued: session.queued.slice(1) });
      }
    } finally {
      this.runs.delete(sessionId);
    }
  }

  private baseOptions(project: string): Options {
    const pc = this.cfg.projects[project];
    return {
      cwd: pc.path,
      env: envForProfile(this.cfg, this.registry.get(project).profile),
      pathToClaudeCodeExecutable: this.cfg.claudeBin,
      model: pc.model,
      settingSources: ["user", "project", "local"], // CLAUDE.md + the same allowlists your VS Code sessions use
      systemPrompt: { type: "preset", preset: "claude_code" },
    };
  }

  private async runOne(sessionId: string, instruction: string, ac: AbortController) {
    const session = this.registry.session(sessionId);
    const { project, number: sessionNumber } = session;
    const subject = () => ({ project, session: sessionId, label: this.registry.labelOf(sessionId), task: instruction, sessionNumber });
    this.registry.updateSession(sessionId, {
      status: "running",
      task: instruction,
      startedAt: new Date().toISOString(),
      lastError: undefined,
      lastActivity: undefined,
    });

    // Destructive commands always go to a voice prompt, even if an allow rule would pass them.
    const forceAsk: HookCallback = async (input) => {
      if (input.hook_event_name !== "PreToolUse") return {};
      const rule = this.destructive.match(input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>);
      return rule
        ? { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: `destructive (${rule.verb})` } }
        : {};
    };

    let failureReported = false;
    try {
      const q = this.query({
        prompt:
          instruction +
          "\n\n(You are running headless and directed by voice. When finished, end with a 2-3 sentence plain-language summary of what you did and anything the user must decide.)",
        options: {
          ...this.baseOptions(project),
          resume: session.claudeSessionId,
          abortController: ac,
          permissionMode: "default",
          canUseTool: (toolName, input, opts) =>
            this.broker.request(sessionId, toolName, input, opts.suggestions, opts.signal),
          hooks: { PreToolUse: [{ hooks: [forceAsk] }] },
        },
      });

      for await (const msg of q) {
        if ("session_id" in msg && msg.session_id && msg.session_id !== this.registry.session(sessionId).claudeSessionId)
          this.registry.updateSession(sessionId, { claudeSessionId: msg.session_id });

        if (msg.type === "assistant") this.recordAssistant(sessionId, msg.message.content as ContentBlock[]);

        if (msg.type === "result") {
          const cost = this.registry.session(sessionId).costUsd + (msg.total_cost_usd ?? 0);
          if (msg.subtype === "success" && !msg.is_error) {
            this.registry.updateSession(sessionId, { status: "done", lastResult: msg.result, finishedAt: new Date().toISOString(), costUsd: cost });
            this.registry.recordTask(sessionId, { task: instruction, outcome: "done", result: msg.result });
            this.registry.emitEvent({ kind: "task_done", ...subject(), result: msg.result.slice(-1200) });
            this.limits.endEpisode(this.registry.get(project).profile);
            this.say(sessionId, "status", "Finished.");
          } else {
            this.registry.updateSession(sessionId, { costUsd: cost });
            this.fail(sessionId, instruction, msg.subtype === "success" ? msg.result : msg.subtype);
            failureReported = true;
          }
        }
      }
    } catch (e) {
      if (ac.signal.aborted) {
        this.registry.updateSession(sessionId, { status: "stopped", finishedAt: new Date().toISOString() });
        this.registry.recordTask(sessionId, { task: instruction, outcome: "stopped", result: "Stopped by the user." });
        this.say(sessionId, "status", "Stopped.");
      } else if (!failureReported) this.fail(sessionId, instruction, (e as Error).message); // else Claude Code repeating the error result it just sent
    }
  }

  /** A failed task; one that hit its account's usage limit is saved to todo with the session's queue instead of being reported. */
  private fail(sessionId: string, instruction: string, error: string) {
    const { project, number: sessionNumber, queued } = this.registry.session(sessionId);
    this.registry.updateSession(sessionId, { status: "failed", lastError: error, finishedAt: new Date().toISOString() });
    const limit = detectUsageLimit(error);
    if (!limit) this.registry.recordTask(sessionId, { task: instruction, outcome: "failed", result: error }); // a limit hit never ran; it waits in todo
    if (limit) {
      this.registry.updateSession(sessionId, { queued: [] });
      this.limits.park(sessionId, [instruction, ...queued], limit);
      this.say(sessionId, "status", `The ${this.registry.get(project).profile} account hit its usage limit; saved to todo: this task${queued.length ? ` and ${queued.length} queued` : ""}.`, true);
      return;
    }
    this.registry.emitEvent({ kind: "task_failed", project, session: sessionId, label: this.registry.labelOf(sessionId), task: instruction, sessionNumber, error });
    this.say(sessionId, "status", `Failed: ${error}`, true);
  }

  /** The worker's words go to the session's chat; its tool calls also become its current activity. */
  private recordAssistant(sessionId: string, content: ContentBlock[]) {
    for (const block of content) {
      if (block.type === "text" && block.text?.trim()) this.say(sessionId, "reply", block.text.trim());
      if (block.type !== "tool_use" || !block.name) continue;
      const input = block.input ?? {};
      const detail = block.name === "Bash" ? String(input.command ?? "").slice(0, 80) : String(input.file_path ?? "");
      const activity = `${block.name} ${detail}`.trim();
      this.registry.updateSession(sessionId, { lastActivity: activity });
      this.say(sessionId, "tool", activity);
    }
  }

  private say(session: string, kind: ChatKind, text: string, failed?: boolean) {
    const message: SessionMessage = { session, kind, text, ...(failed && { failed }) };
    this.emit("message", message);
  }

  /**
   * Spoken summary of the latest changes in the project's active session, produced INSIDE the project's own account
   * (a read-only fork of its session). Only this short text reaches the orchestrator,
   * so work code never passes through your personal account in raw form.
   */
  async summarize(project: string, focus?: string): Promise<string> {
    const session = this.registry.activeSession(project);
    const prompt =
      `In 3-4 sentences meant to be spoken aloud, explain the implementation of the latest changes` +
      (focus ? ` with focus on: ${focus}` : "") +
      `. Use git status/diff if useful. No code, no markdown, mention file names only if essential.`;
    let out = "";
    const q = this.query({
      prompt,
      options: {
        ...this.baseOptions(project),
        resume: session.claudeSessionId,
        forkSession: true, // don't pollute the worker's own session
        permissionMode: "dontAsk",
        allowedTools: ["Read", "Grep", "Glob", "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)"],
        maxTurns: 8,
      },
    });
    for await (const msg of q) if (msg.type === "result") out = msg.subtype === "success" ? msg.result : `Couldn't summarize: ${msg.subtype}`;
    return out || "No summary available.";
  }
}
