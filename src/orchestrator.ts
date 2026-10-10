import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { promisify } from "node:util";
import { z } from "zod";
import { existsSync } from "node:fs";
import { query as sdkQuery, tool, createSdkMcpServer, type HookCallback, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { APP_DIR, AppConfig, type SpeechMode, envForProfile, resolveProject, findProjectDirs, saveProject, expandHome, normName } from "./config.js";
import { Registry, AppEvent } from "./registry.js";
import { PermissionBroker } from "./permissions.js";
import { WorkerManager, type QueryFn } from "./workers.js";
import { DestructiveList, utteranceConfirms } from "./destructive.js";
import type { VoiceIO, VoiceInputState } from "./voice.js";
import type { ConversationMemory } from "./memory.js";
import { NOTE_SECTIONS, type AssistantNotes } from "./notes.js";
import { spokenGist } from "./gist.js";
import { usageLimitMessage } from "./usage-limit.js";
import type { ScreenSource } from "./screen.js";

const run = promisify(execFile);

type ToolContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
type ToolResult = { content: ToolContent[] };
const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });

/** The only tools the operator may use from the user's claude.ai connectors: Google Calendar, named one by one so other connectors stay blocked. */
const CALENDAR_TOOL_PREFIX = "mcp__claude_ai_Google_Calendar__";
const CALENDAR_TOOLS = [
  "list_calendars", "list_events", "search_events", "get_event", "suggest_time",
  "create_event", "update_event", "respond_to_event", "delete_event",
].map((name) => CALENDAR_TOOL_PREFIX + name);

const SYSTEM_PROMPT = `You are a voice operator for a developer's coding agents. Everything you write is read aloud by text-to-speech.

How to talk:
- 1 to 3 short sentences. No markdown, lists, code, paths or IDs unless asked. Natural speech.
- Anything after a line "[SCREEN]" is shown in the web UI's chat and never spoken. Use it when a fuller explanation helps: say the short version, then [SCREEN] and the detailed one (plain text; short lists and file names are fine there).
- Reply in the language the user spoke.
- Never invent status. Use project_status or list_projects when asked about progress.
- When an account hits its usage or spend limit, its failed tasks are saved to a todo list instead of being retried; the user is told once. When they ask what's waiting or want to retry after the limit resets, use list_todo and run_todo.
- When the user refers to earlier work on a project ("what did webshop do yesterday", "continue from last time"), call project_history. It survives restarts.
- "Auto mode" means workers run everything except destructive commands without asking; "ask mode" means every request goes to the user. Switch with set_permission_mode when asked.
- When the user asks to restart the orchestrator or the app itself (not just your context), call restart_orchestrator and say a short confirmation like "Restarting now, back in a few seconds." If list_projects shows a task running, tell the user it will be stopped and ask first.
- When the user asks to restart, reset or clear your context, call reset_context. Keep notes unless they want you to forget everything. Project state and task history are kept either way.
- When the user says "remember this" or states a lasting alias, preference or fact about a project, call remember with one short line. Your notes are read back into these instructions whenever you start.
- You can use the user's Google Calendar (the ${CALENDAR_TOOL_PREFIX}* tools): view and search events, find free time, add events, change them (for example to add a reminder), answer invitations and delete events. Viewing and adding need no confirmation; when adding, if the day or time is unclear, ask first. After any change, say in one sentence what you did.
- Changing or deleting a calendar event is destructive: first find the event, tell the user its title, day and time and exactly what you will change (or that you will delete it), and ask them to say "confirm update" or "confirm delete". Call the tool only in your reply to that phrase.
- When the user asks about something on their screen ("look at this", "what's this error"), call look_at_screen. Describe only what answers their question; never read the screen out in full.

What you control:
- To work on a folder that isn't a known project yet, call open_project first (it finds the folder by spoken name and picks the account; "company"/"work" means the work account, "private"/"personal" means personal). If several folders match, ask which one.
- Each project has a background Claude Code worker (some on the personal account, some on work). Use run_task to give it instructions in plain words, exactly as the user means them. Don't do the work yourself.
- A project can have several sessions, like tabs in VS Code, each its own worker conversation. run_task, stop_task and summarize_changes act on the project's active session. new_session opens a fresh one and makes it active; switch_session changes the active one; list_sessions lists them; close_session stops a session's worker and deletes it with its history. Say sessions as "webshop session 2".
- summarize_changes gives a spoken 3-4 sentence implementation summary. Use it when the user wants details.
- git runs simple git commands directly (e.g. "move to stage" = git add -A, nothing else).
- Speech recognition is imperfect: map near-miss project names to real ones; if an instruction is ambiguous AND acting on it would be hard to undo, ask one short question.

Incoming messages:
- "[USER] ..." is the user speaking.
- "[NOTICE] ..." lines report what the user was already told (e.g. an account hit its usage limit). Don't repeat them; use them if the user asks.
- "[UI] ..." lines report what the user did by clicking in the web UI (answered a permission, sent a task directly). Treat them as done; don't ask about them again.
- "[EVENT] ..." is a notification. Announce it briefly. For finished or failed tasks the user has already heard "<project> session <n> done: <a few words of the task>" (or "failed"). If the task answered a question the user asked, give a brief spoken answer (a few short sentences), then [SCREEN] and the full explanation from the worker's closing note. Otherwise start your reply with [SCREEN], so nothing more is spoken: say on screen which project finished and offer details ("Want details?"); don't summarize the full result unless asked.
- "[PERMISSION pN] ..." is a worker waiting for approval. Say which project and what it wants in plain words, then: "Allow once, always, or deny?". When the user answers, call answer_permission with that id.
- Notifications come to you one at a time: the next one waits until the user has answered yours. The user's next words answer the question you just asked.
- "(N more waiting)" after a notification means more are queued; mention it in a few words ("two more after this").

Destructive actions (git push/commit/reset, rm -rf, deploys, the editable list):
- They need the user to literally say "confirm <verb>", e.g. "confirm push". A plain "yes" is NOT enough.
- Tell them the exact phrase to say. The system checks their actual words; don't call the approving tool before they've said it.
- They can never be "always" allowed.
- Edits to the destructive list itself need "confirm edit".`;

/** Async queue feeding the long-lived orchestrator session (SDK streaming input mode). */
class Inbox implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = [];
  private waiter?: (r: IteratorResult<SDKUserMessage>) => void;
  private closed = false;
  push(content: string) {
    const msg: SDKUserMessage = {
      type: "user",
      message: { role: "user", content },
      parent_tool_use_id: null,
      origin: { kind: "human" },
    };
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = undefined;
      w({ value: msg, done: false });
    } else this.items.push(msg);
  }
  close() {
    this.closed = true;
    this.waiter?.({ value: undefined, done: true });
  }
  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift()!, done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((r) => (this.waiter = r));
      },
    };
  }
}

/** What a context reset carries into the new session: a short handoff note, or nothing. */
type ResetMode = "notes" | "nothing";

/** Where your words came from. Replies to typed messages are shown in the UI, not spoken. */
export type InputSource = "voice" | "ui";

type Input =
  | { kind: "user"; text: string; source: InputSource }
  | { kind: "event"; text: string; permissionId?: string; urgent: boolean; announcement?: string }
  /** Said once and shown, without a model turn; the model hears of it with your next message. */
  | { kind: "notice"; text: string; spoken: string }
  | { kind: "clear"; saved: () => void; failed: (error: unknown) => void };

/** What the model gets a turn for. */
type TurnInput = Extract<Input, { kind: "user" | "event" }>;

/** One line of the conversation, for the UI feed. */
export interface ConversationLine {
  role: "user" | "orchestrator";
  text: string;
  source?: InputSource;
}

/** The question just asked aloud. The next notification waits for its answer so your replies are never ambiguous. */
interface OpenQuestion {
  permissionId?: string;
  /** For questions that don't block work (e.g. "want details?"): stop waiting after this. */
  until: number;
}

export class Orchestrator extends EventEmitter {
  private inbox!: Inbox;
  private speech: SpeechMode;
  private turnResolve?: (t: string) => void;
  private turnText = "";
  /** Hears each piece of the current turn's text as it arrives. */
  private onTurnText?: (text: string) => void;
  private sessionStartedAt = 0;
  /** Crashes since the last turn that completed; sets the wait before the next restart. */
  private crashStreak = 0;
  private requestedReset?: ResetMode;
  private restartRequested = false;
  private inputs: Input[] = [];
  private busy = false;
  private openQuestion?: OpenQuestion;
  /** Things you did in the UI since the model's last turn; prepended to its next message. */
  private uiNotes: string[] = [];
  /** Transcript of the utterance currently being handled; undefined during event turns. */
  private currentUtterance?: string;

  constructor(
    private cfg: AppConfig,
    private registry: Registry,
    private workers: WorkerManager,
    private broker: PermissionBroker,
    private destructive: DestructiveList,
    private voice: VoiceIO,
    private screen: ScreenSource,
    private memory: ConversationMemory,
    private notes: AssistantNotes,
    private query: QueryFn = sdkQuery,
  ) {
    super();
    this.speech = cfg.voice.speak;
    this.defs = this.toolDefs();
    voice.onPress(() => screen.capture()); // what you're looking at when you start asking, not seconds later
    voice.onUtterance((t) => this.enqueue({ kind: "user", text: t, source: "voice" }));
    registry.on("event", (e: AppEvent) => this.enqueue(this.inputFor(e)));
  }

  private inputFor(e: AppEvent): Input {
    if (e.kind === "usage_limit") return { kind: "notice", text: this.describeEvent(e), spoken: usageLimitMessage(e.project, e.account, e.resetsAt, e.savedTasks) };
    return {
      kind: "event",
      text: this.describeEvent(e),
      permissionId: e.kind === "permission" ? e.id : undefined,
      urgent: e.kind !== "task_done",
      announcement: announcementFor(e),
    };
  }

  /** A message typed in the UI; handled like speech, answered on screen. */
  receiveTyped(text: string) {
    this.enqueue({ kind: "user", text, source: "ui" });
  }

  /** Keep the model in sync with clicks, without spending a turn on them. */
  noteUiAction(text: string) {
    this.uiNotes.push(`[UI] ${text}`);
  }

  /**
   * Restarts the model's context once any reply in progress is done, carrying only a handoff the model
   * writes first (a short summary and key facts); the saved exchanges are dropped. Resolves once the
   * handoff is saved to memory. Projects, sessions and their history are untouched.
   */
  clearConversation(): Promise<void> {
    // queued like a message, so it runs after what you already said and nothing sent meanwhile can take the handoff's turn
    return new Promise((saved, failed) => this.enqueue({ kind: "clear", saved, failed }));
  }

  get speechMode(): SpeechMode {
    return this.speech;
  }

  /** Whether you're talking, or your words are held a moment before they're sent. */
  get voiceInput(): VoiceInputState {
    return this.voice.inputState();
  }

  setSpeechMode(mode: SpeechMode) {
    this.speech = mode;
    if (mode === "muted") this.voice.stopSpeaking();
  }

  async start() {
    this.startSession();
    await this.voice.start();
  }

  private describeEvent(e: AppEvent): string {
    switch (e.kind) {
      case "task_done":
        return `[EVENT] ${e.label} finished its task. Worker's closing note: ${e.result}\nTask (session ${e.sessionNumber}): ${e.task}`;
      case "task_failed":
        return `[EVENT] ${e.label} failed: ${e.error}\nTask (session ${e.sessionNumber}): ${e.task}`;
      case "permission":
        return (
          `[PERMISSION ${e.id}] ${e.reminder ? "(reminder, still waiting) " : ""}${e.label} wants approval for ${e.description}` +
          (e.destructiveVerb ? ` -- DESTRUCTIVE: user must say "confirm ${e.destructiveVerb}".` : "")
        );
      case "usage_limit":
        return `[NOTICE] ${usageLimitMessage(e.project, e.account, e.resetsAt, e.savedTasks)}. Later limit failures on this account are saved to todo without notice.`;
    }
  }

  // ---------------------------------------------------------------- session

  /** Tool definitions. Exposed to the model via an in-process MCP server, and to tests via callTool(). */
  private toolDefs() {
    const project = z.string().describe("Project name as spoken; matched loosely");
    const need = (spoken: string) => {
      const name = resolveProject(this.cfg, spoken);
      if (!name)
        throw new Error(`No project like "${spoken}". Known: ${Object.keys(this.cfg.projects).join(", ") || "none"}. Use open_project to add it.`);
      return name;
    };
    const sessionNumber = z.number().int().positive().describe("Session number within the project, as in 'session 2'");
    const profileArg = z.string().describe(`Account: ${Object.keys(this.cfg.profiles).join(" | ")}`);
    const defs = [
      tool("list_projects", "All projects with status, account and current activity.", {}, async () =>
        text(this.registry.snapshot() || "No projects yet.")),

      tool("open_project", "Find a folder by spoken name (or exact path) and register it as a project on the given account.",
        { name: z.string().describe("Spoken name, e.g. 'database admin', or a path"), profile: profileArg.optional() },
        async ({ name, profile }) => {
          const prof = profile ?? this.cfg.orchestrator.profile;
          if (!this.cfg.profiles[prof]) throw new Error(`Unknown account ${prof}`);
          const asPath = expandHome(name);
          const dirs = name.includes("/") && existsSync(asPath) ? [asPath] : findProjectDirs(this.cfg, name);
          if (!dirs.length) return text(`No folder matching "${name}" under ${this.cfg.searchRoots.join(", ")}.`);
          if (dirs.length > 1 && normName(dirs[0].split("/").pop()!) !== normName(dirs[1].split("/").pop()!) &&
              normName(dirs[0].split("/").pop()!) !== normName(name) && !findExact(dirs, name))
            return text(`Several matches, ask the user which: ${dirs.join(" | ")}`);
          const dir = findExact(dirs, name) ?? dirs[0];
          const key = dir.split("/").pop()!;
          const existing = Object.entries(this.cfg.projects).find(([, p]) => p.path === dir);
          if (existing) {
            if (profile && existing[1].profile !== profile) await this.callTool("set_project_account", { project: existing[0], profile });
            return text(`${existing[0]} is already a project (${this.registry.get(existing[0]).profile} account), at ${dir}.`);
          }
          saveProject(this.cfg, key, { path: dir, profile: prof });
          this.registry.ensure(key, prof);
          return text(`Opened ${key} at ${dir} on the ${prof} account.`);
        }),

      tool("project_status", "Detailed status of one project's active session.", { project }, async ({ project: p }) => {
        const name = need(p);
        const session = this.registry.activeSession(name);
        const { profile } = this.registry.get(name);
        const openSessions = this.registry.sessionsOf(name).length;
        return text(JSON.stringify({ ...session, profile, openSessions, lastResult: session.lastResult?.slice(-600) }, null, 1));
      }),

      tool("list_sessions", "A project's open sessions with their status; marks the active one.", { project },
        async ({ project: p }) => text(this.registry.sessionList(need(p)))),

      tool("new_session", "Open a fresh worker session in a project and make it the active one.", { project },
        async ({ project: p }) => {
          const session = this.registry.createSession(need(p));
          return text(`Opened ${session.project} session ${session.number}; it is now active.`);
        }),

      tool("switch_session", "Make another of a project's sessions the active one.", { project, session: sessionNumber },
        async ({ project: p, session: n }) => {
          const session = this.registry.sessionByNumber(need(p), n);
          this.registry.activate(session.id);
          return text(`${session.project} session ${session.number} is now active.`);
        }),

      tool("close_session", "Close a session for good: stops its worker and deletes its queue and history.", { project, session: sessionNumber },
        async ({ project: p, session: n }) => text(await this.workers.closeSession(this.registry.sessionByNumber(need(p), n).id))),

      tool("run_task", "Send an instruction to a project's coding worker. Queued if it is busy.",
        { project, instruction: z.string().describe("What the worker should do, in plain words") },
        async ({ project: p, instruction }) => text(this.workers.run(need(p), instruction))),

      tool("list_todo", "Tasks saved to the todo list because their account hit a usage limit: id, project, session, account, when saved, when the limit resets, and the task.", {},
        async () => text(this.todoListing())),

      tool("run_todo", "Run a saved todo task (or all of them) in its project's active session, like run_task, and take it off the list. Use after the limit has reset, when the user asks.",
        { id: z.string().describe('A todo id from list_todo, or "all"') },
        async ({ id }) => text(this.runTodo(id))),

      tool("discard_todo", "Delete a saved todo task without running it, when the user asks.", { id: z.string().describe("A todo id from list_todo") },
        async ({ id }) => text(this.workers.discardSavedTask(id))),

      tool("project_history", "A project's recent finished tasks with the worker's closing notes, including ones from before a restart.",
        { project },
        async ({ project: p }) => text(this.registry.historyOf(need(p)))),

      tool("remember", "Add one line to the user's notes file, kept across resets and restarts.",
        {
          note: z.string().describe("One short line in plain words, e.g. 'dbadmin is also called database admin'"),
          section: z.enum(NOTE_SECTIONS).describe("Aliases: other names for projects or things; Project notes: facts about a project; Other: anything else"),
        },
        async ({ note, section }) => text(this.notes.remember(note, section))),

      tool("reset_context","Restart your own conversation context once this reply is spoken.",
        { keep: z.enum(["notes", "nothing"]).describe("notes: carry a short handoff into the new session; nothing: start completely fresh") },
        async ({ keep }) => {
          this.requestedReset = keep;
          return text(`Context will reset after this reply${keep === "notes" ? ", keeping a short handoff" : ", starting fresh"}.`);
        }),

      tool("restart_orchestrator", "Restart the whole Voice Orchestrator app once this reply is spoken. Running worker tasks are stopped; projects, sessions, history and notes are kept.", {},
        async () => {
          this.restartRequested = true;
          return text("The app will restart after this reply.");
        }),

      tool("stop_task", "Stop a running worker and clear its queue.", { project },
        async ({ project: p }) => text(this.workers.stop(need(p)))),

      tool("summarize_changes", "3-4 sentence spoken explanation of the latest implementation, generated on the project's own account.",
        { project, focus: z.string().optional() },
        async ({ project: p, focus }) => text(await this.workers.summarize(need(p), focus))),

      tool("git", "Run a git command in the project, e.g. 'add -A', 'status --short'. Destructive ones need the confirm phrase.",
        { project, args: z.string().describe("Arguments after 'git'") },
        async ({ project: p, args }) => text(await this.git(need(p), args))),

      tool("list_pending_permissions", "Worker permission requests waiting for an answer.", {},
        async () => text(JSON.stringify(this.broker.list()))),

      tool("set_permission_mode", "auto: workers skip permission prompts except for destructive commands. ask: every request goes to the user. Lasts until restart.",
        { mode: z.enum(["auto", "ask"]) },
        async ({ mode }) => text(this.broker.setMode(mode))),

      tool("answer_permission", "Answer a worker's permission request.",
        { id: z.string(), decision: z.enum(["once", "always", "deny"]), denyReason: z.string().optional() },
        async ({ id, decision, denyReason }) => text(this.broker.answer(id, decision, this.currentUtterance, denyReason))),

      tool("set_project_account", "Switch which Claude account a project's workers use (each session starts a fresh conversation).",
        { project, profile: profileArg },
        async ({ project: p, profile }) => {
          const name = need(p);
          if (!this.cfg.profiles[profile]) throw new Error(`Unknown account ${profile}`);
          if (this.workers.isBusy(name)) throw new Error(`${name} is busy; stop it first`);
          this.registry.update(name, { profile });
          // sessions live inside a config dir, so a switch can't resume the old ones
          for (const session of this.registry.sessionsOf(name)) this.registry.updateSession(session.id, { claudeSessionId: undefined });
          saveProject(this.cfg, name, { ...this.cfg.projects[name], profile });
          return text(`${name} will use the ${profile} account from its next task, in a fresh session.`);
        }),

      tool("look_at_screen", "See the user's screen as it was when they started speaking (the display under their cursor).", {},
        async (): Promise<ToolResult> => ({
          content: [
            { type: "text", text: "The user's screen when they started speaking:" },
            { type: "image", ...(await this.screen.latest()) },
          ],
        })),

      tool("destructive_rules", "List the destructive-action rules.", {},
        async () => text(this.destructive.list().map((r) => `${r.verb}: /${r.pattern}/`).join("\n"))),

      tool("destructive_add", "Add a destructive rule. Needs the user to say 'confirm edit'.",
        { pattern: z.string().describe("Case-insensitive regex, e.g. \\bterraform\\s+apply\\b"), verb: z.string().describe("Word for 'confirm <verb>'") },
        async ({ pattern, verb }) => {
          if (!utteranceConfirms(this.currentUtterance, "edit")) return text(`Not done. Ask the user to say "confirm edit".`);
          this.destructive.add({ pattern, verb: verb.toLowerCase() });
          return text(`Added: say "confirm ${verb}" for /${pattern}/.`);
        }),

      tool("destructive_remove", "Remove a destructive rule by its exact pattern. Needs 'confirm edit'.", { pattern: z.string() },
        async ({ pattern }) => {
          if (!utteranceConfirms(this.currentUtterance, "edit")) return text(`Not done. Ask the user to say "confirm edit".`);
          return text(this.destructive.remove(pattern) ? `Removed /${pattern}/.` : `No rule with that pattern.`);
        }),
    ];
    // errors become tool results the model can read aloud, instead of crashing the session
    return defs.map((d) => ({
      ...d,
      handler: async (a: unknown, extra: unknown): Promise<ToolResult> => {
        try {
          return await (d.handler as (a: unknown, e: unknown) => Promise<ToolResult>)(a, extra);
        } catch (e) {
          return text(`Error: ${(e as Error).message}`);
        }
      },
    }));
  }

  private defs!: ReturnType<Orchestrator["toolDefs"]>;

  /** Invoke a tool directly (used by tests and internally). Returns the text result. */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const d = this.defs.find((x) => x.name === name);
    if (!d) throw new Error(`no tool ${name}`);
    const r = await d.handler(args, {});
    return r.content.map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");
  }

  private todoListing(): string {
    const saved = this.workers.savedTasks();
    if (!saved.length) return "The todo list is empty.";
    return saved
      .map((t) => `${t.id}: ${t.project} session ${t.sessionNumber}, ${t.account} account, saved ${t.savedAt}${t.resetsAt ? `, limit resets ${t.resetsAt}` : ""}\n  ${t.task.slice(0, 300)}`)
      .join("\n");
  }

  private runTodo(id: string): string {
    const ids = id === "all" ? this.workers.savedTasks().map((t) => t.id) : [id];
    if (!ids.length) return "The todo list is empty.";
    return ids.map((one) => this.runOneTodo(one)).join("\n");
  }

  private runOneTodo(id: string): string {
    try {
      return this.workers.runSavedTask(id);
    } catch (error) {
      return (error as Error).message;
    }
  }

  /** For tests: set the transcript that permission/destructive checks see. */
  withUtterance<T>(u: string | undefined, fn: () => Promise<T>): Promise<T> {
    this.currentUtterance = u;
    return fn().finally(() => (this.currentUtterance = undefined));
  }

  /** The operator's own destructive tool calls (e.g. deleting a calendar event) run only if the user's words contain the confirm phrase. */
  private requireConfirmPhrase: HookCallback = async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const rule = this.destructive.match(input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>);
    if (!rule || utteranceConfirms(this.currentUtterance, rule.verb)) return {};
    const reason = `Destructive (${rule.verb}). Not run. Tell the user what will change and ask them to say "confirm ${rule.verb}".`;
    return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } };
  };

  private async git(project: string, args: string): Promise<string> {
    const argv = args.match(/"[^"]*"|'[^']*'|\S+/g)?.map((a) => a.replace(/^["']|["']$/g, "")) ?? [];
    if (argv[0] === "git") argv.shift();
    const rule = this.destructive.matchText(`git ${argv.join(" ")}`);
    if (rule && !utteranceConfirms(this.currentUtterance, rule.verb))
      return `Destructive (${rule.verb}). Not run. Ask the user to say "confirm ${rule.verb}".`;
    const { stdout, stderr } = await run("git", argv, { cwd: this.cfg.projects[project].path, maxBuffer: 1 << 20 });
    return (stdout + stderr).trim().slice(0, 1500) || "Done, no output.";
  }

  private startSession() {
    this.inbox = new Inbox();
    this.runSession(this.inbox);
  }

  private runSession(inbox: Inbox) {
    this.sessionStartedAt = Date.now();
    const q = this.query({
      prompt: inbox,
      options: {
        cwd: APP_DIR,
        // settingSources is empty, so the account's claude.ai connectors (Google Calendar) load only with this flag
        env: { ...envForProfile(this.cfg, this.cfg.orchestrator.profile), ENABLE_CLAUDEAI_MCP_SERVERS: "1" },
        pathToClaudeCodeExecutable: this.cfg.claudeBin,
        model: this.cfg.orchestrator.model,
        systemPrompt: this.systemPrompt(),
        settingSources: [], // ignore CLAUDE.md etc.; the orchestrator is not a coding agent
        mcpServers: { ctl: createSdkMcpServer({ name: "ctl", version: "0.1.0", tools: this.defs }) },
        tools: [], // no built-in tools (no Bash/Edit) — it can only act through ctl and the calendar
        allowedTools: ["mcp__ctl__*", ...CALENDAR_TOOLS],
        permissionMode: "dontAsk",
        hooks: { PreToolUse: [{ hooks: [this.requireConfirmPhrase] }] },
      },
    });

    void (async () => {
      try {
        for await (const msg of q) {
          if (msg.type === "assistant")
            for (const b of msg.message.content) if (b.type === "text") this.receiveTurnText(b.text);
          if (msg.type === "result") {
            this.crashStreak = 0;
            const t = this.turnText.trim() || (msg.subtype === "success" ? msg.result : "");
            this.turnText = "";
            this.turnResolve?.(t);
          }
        }
      } catch (e) {
        console.error(`[orchestrator] session error: ${(e as Error).message}`);
        this.turnResolve?.("Sorry, my control session crashed. Restarting it.");
        this.restartAfterCrash(inbox);
      }
    })();
  }

  /**
   * Waits longer after each crash in a row, so a session that dies on start can't spin.
   * The new inbox is swapped in right away: messages sent during the wait queue there for the new session.
   */
  private restartAfterCrash(crashed: Inbox) {
    if (crashed !== this.inbox) return; // a context reset already started a new session
    const delay = Math.min(FIRST_RESTART_DELAY_MS * 2 ** this.crashStreak, MAX_RESTART_DELAY_MS);
    this.crashStreak++;
    const next = new Inbox();
    this.inbox = next;
    console.error(`[orchestrator] restarting in ${delay / 1000}s`);
    setTimeout(() => {
      if (next === this.inbox) this.runSession(next);
    }, delay);
  }

  private systemPrompt(): string {
    const notes = this.notes.read();
    return [
      SYSTEM_PROMPT,
      this.cfg.orchestrator.rules.length &&
        `The user's standing rules (follow them, except where they conflict with the destructive-action rules):\n${this.cfg.orchestrator.rules.map((r) => `- ${r}`).join("\n")}`,
      notes && `The user's notes (follow them like the standing rules):\n${notes}`,
      `Now: ${new Date().toString()}.`, // for calendar events; your custom prompt replaces Claude Code's own date line
      `Projects: ${Object.keys(this.cfg.projects).join(", ")}. Accounts: ${Object.keys(this.cfg.profiles).join(", ")}.`,
      `Current project status:\n${this.registry.snapshot()}`,
      this.registry.recentWork() && `Recent tasks per project (oldest first):\n${this.registry.recentWork()}`,
      this.broker.list().length && `Permission requests still waiting: ${JSON.stringify(this.broker.list())}`,
      this.memory.recap(),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Resolves with the turn's whole reply; `onText` hears each piece as the model writes it, before its tool calls run.
   * A reply that wasn't streamed (e.g. the crash notice) reaches `onText` whole, just before the turn resolves.
   */
  private ask(content: string, onText?: (text: string) => void): Promise<string> {
    let streamed = false;
    this.onTurnText = (text) => {
      streamed = true;
      onText?.(text);
    };
    return new Promise((resolve) => {
      this.turnResolve = (reply) => {
        if (!streamed && reply) onText?.(reply);
        resolve(reply);
      };
      this.inbox.push(content);
    });
  }

  private receiveTurnText(text: string) {
    this.turnText += text + " ";
    if (text.trim()) this.onTurnText?.(text.trim());
  }

  /** Shows a turn's reply piece by piece as it arrives, so it is on screen before the tools finish. */
  private askShown(content: string): Promise<string> {
    return this.ask(content, (text) => this.showReplyPiece(text));
  }

  /**
   * Shows and speaks a voice turn's reply piece by piece as it arrives, so an acknowledgment is heard before the tools finish.
   * Each piece is shown before it is queued for speech, so the screen is never behind the voice.
   */
  private async askAloud(content: string): Promise<string> {
    let spoken = Promise.resolve();
    let screenOnly = false;
    const reply = await this.ask(content, (text) => {
      this.showReplyPiece(text);
      if (screenOnly) return;
      screenOnly = text.includes(SCREEN_MARKER);
      const aloud = spokenPart(text);
      if (aloud) spoken = spoken.then(() => this.speakWhenQuiet(aloud));
    });
    await spoken;
    return reply;
  }

  private showReplyPiece(text: string) {
    const shown = onScreen(text);
    if (shown) this.say({ role: "orchestrator", text: shown });
  }

  // ---------------------------------------------------------------- input loop

  private enqueue(i: Input) {
    // you speaking always jumps ahead of queued notifications
    if (i.kind === "user") {
      const firstNonUser = this.inputs.findIndex((x) => x.kind !== "user");
      this.inputs.splice(firstNonUser === -1 ? this.inputs.length : firstNonUser, 0, i);
    } else this.inputs.push(i);
    void this.pump();
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.inputs.length) {
        const input = this.takeReadyInput();
        if (!input) {
          await sleep(USER_DONE_POLL_MS);
          continue;
        }
        if (input.kind === "clear") {
          await this.clearWithHandoff(input);
          continue;
        }
        if (input.kind === "notice") {
          await this.tell(input);
          continue;
        }
        if (input.kind === "event" && this.isAnsweredPermission(input)) continue;
        if (input.kind === "user") {
          this.openQuestion = undefined;
          this.say({ role: "user", text: input.text, source: input.source });
        }
        if (input.kind === "event" && input.announcement) await this.announce(input, input.announcement);
        this.currentUtterance = input.kind === "user" ? input.text : undefined;
        const message = input.kind === "user" ? `[USER] ${input.text}` : input.text + this.waitingNote();
        const content = [...this.uiNotes.splice(0), message].join("\n");
        const aloud = this.shouldSpeak(input);
        const reply = aloud ? await this.askAloud(content) : await this.askShown(content);
        this.currentUtterance = undefined;
        if (reply) this.finishTurn(input, reply, aloud);
        if (this.restartRequested) return this.restart(); // only after the reply is saved and spoken
      }
      await this.maybeReset();
    } finally {
      this.busy = false;
    }
    if (this.inputs.length) void this.pump();
  }

  /** Hands the restart to the app (see main.ts), which shuts down and is started again by the supervisor. */
  private restart() {
    this.restartRequested = false;
    this.emit("restart");
  }

  private finishTurn(input: TurnInput, reply: string, aloud: boolean) {
    this.memory.record(input.kind === "user" ? `user: ${input.text}` : input.text, onScreen(reply));
    if (aloud && input.kind === "event") this.openQuestion = this.questionFor(input);
  }

  /** Saves the handoff (summary and key facts) to memory first; only then reports the conversation cleared. */
  private async clearWithHandoff(request: Extract<Input, { kind: "clear" }>) {
    try {
      await this.reset("notes");
      request.saved();
    } catch (error) {
      request.failed(error);
    }
  }

  private say(line: ConversationLine) {
    this.emit("line", line);
  }

  private shouldSpeak(input: TurnInput): boolean {
    if (this.speech === "muted") return false;
    if (input.kind === "user") return input.source === "voice";
    if (input.announcement) return true; // only a spoken part before [SCREEN]; the announcement said the rest
    return this.speech === "all" || input.urgent;
  }

  /** A task's short spoken outcome, said before the model's turn so it isn't held up by it. */
  private async announce(input: Extract<Input, { kind: "event" }>, announcement: string) {
    if (this.speech === "muted") return;
    await this.speakWhenQuiet(announcement);
    this.openQuestion = this.questionFor(input);
  }

  private async tell(notice: Extract<Input, { kind: "notice" }>) {
    if (this.speech !== "muted") await this.speakWhenQuiet(notice.spoken);
    this.uiNotes.push(notice.text);
  }

  private async speakWhenQuiet(text: string) {
    // you may have started talking meanwhile
    while (this.voice.isListening()) await sleep(USER_DONE_POLL_MS);
    await this.voice.speak(text);
  }

  /** Next input allowed to go now: your words first; notifications only once you're done talking and have answered the last question. */
  private takeReadyInput(): Input | undefined {
    const index = this.inputs.findIndex((input) => this.isReady(input));
    return index === -1 ? undefined : this.inputs.splice(index, 1)[0];
  }

  private isReady(input: Input): boolean {
    if (input.kind === "user" || input.kind === "clear") return true;
    if (this.voice.isListening()) return false;
    if (!this.isQuestionOpen()) return true;
    // a reminder of the very question you're being asked may repeat it
    return input.kind === "event" && !!input.permissionId && input.permissionId === this.openQuestion?.permissionId;
  }

  private isQuestionOpen(): boolean {
    if (!this.openQuestion) return false;
    const { permissionId, until } = this.openQuestion;
    return permissionId ? this.broker.isPending(permissionId) : Date.now() < until;
  }

  /** A queued reminder for a request that was answered (or stopped) meanwhile. */
  private isAnsweredPermission(input: Extract<Input, { kind: "event" }>): boolean {
    return !!input.permissionId && !this.broker.isPending(input.permissionId);
  }

  private questionFor(input: Extract<Input, { kind: "event" }>): OpenQuestion {
    return { permissionId: input.permissionId, until: Date.now() + this.cfg.orchestrator.answerWindowSeconds * 1000 };
  }

  private waitingNote(): string {
    const waiting = this.inputs.filter((i) => i.kind === "event").length;
    return waiting ? ` (${waiting} more waiting)` : "";
  }

  /** On request, or hourly when idle. Operational state lives in Registry, so nothing is lost. */
  private async maybeReset() {
    if (this.inputs.length) return;
    if (this.requestedReset) return this.reset(this.requestedReset);
    const due = Date.now() - this.sessionStartedAt > this.cfg.orchestrator.resetMinutes * 60_000;
    if (due && !this.broker.list().length) await this.reset("notes");
  }

  private async reset(mode: ResetMode) {
    this.requestedReset = undefined;
    this.memory.startOver(mode === "notes" ? await this.writeHandoff() : "");
    this.inbox.close();
    console.log(`[orchestrator] context reset (${mode === "notes" ? "with handoff" : "fresh"})`);
    this.startSession();
  }

  private writeHandoff(): Promise<string> {
    return this.ask(
      "[SYSTEM] Context reset now. Write a handoff for your next session in at most 150 words: a short summary of what you and the user talked about, " +
        "key facts worth keeping, user decisions and preferences stated this session, promises you made (e.g. 'tell me when X finishes'), open questions. " +
        "Skip project statuses; those are tracked separately. Plain text.",
    );
  }
}

/** What's said aloud the moment a task ends, e.g. "acme-web done". */
function announcementFor(e: AppEvent): string | undefined {
  if (e.kind === "task_done") return `${e.project} session ${e.sessionNumber} done: ${spokenGist(e.task)}`;
  if (e.kind === "task_failed") return `${e.project} session ${e.sessionNumber} failed: ${spokenGist(e.task)}`;
  return undefined;
}

/** The part of a reply that is spoken: everything before [SCREEN]. */
function spokenPart(reply: string): string {
  return reply.split(SCREEN_MARKER)[0].trim();
}

/** A reply as the web UI shows it: the spoken part, then the screen-only explanation. */
function onScreen(reply: string): string {
  return reply.split(SCREEN_MARKER).map((part) => part.trim()).filter(Boolean).join("\n\n");
}

function findExact(dirs: string[], spoken: string) {
  return dirs.find((d) => normName(d.split("/").pop()!) === normName(spoken));
}

/** Text after this in a reply is shown in the web UI and never spoken. */
const SCREEN_MARKER = "[SCREEN]";
const USER_DONE_POLL_MS = 200;
const FIRST_RESTART_DELAY_MS = 1000;
const MAX_RESTART_DELAY_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
