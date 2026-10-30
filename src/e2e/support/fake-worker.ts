import { execSync } from "node:child_process";
import type { HookJSONOutput, Options, PermissionUpdate, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import { accountOf } from "./sandbox.js";

/**
 * A scripted Claude Code worker. Its instruction is a script, one step per line:
 *   run: <shell command>   -> asks permission like Claude Code does, then really executes it
 *   sleep: <ms>            -> simulates a long step (abortable)
 *   error: <text>          -> ends with an error result, then throws it again, as Claude Code does
 *   turn: <text>           -> ends a turn and goes on, as Claude Code does while background helpers still run
 *   ask: <question>|<a>,<b> -> asks you with AskUserQuestion, like Claude Code does, and notes your answer
 * Other lines are ignored. Each call records which CLAUDE_CONFIG_DIR (= which account) it was started with.
 */

export interface WorkerCall {
  cwd: string;
  account: string;
  resume?: string;
  bin?: string;
  summary: boolean;
}

export const workerCalls: WorkerCall[] = [];
/** A turn's running total, as Claude Code reports it at a turn's end. */
const TURN_COST_USD = 0.005;
export const sessionsByCwd = new Map<string, string>();
/** Per account: commands allowed "always". */
const alwaysAllowed = new Map<string, Set<string>>();

interface StepContext {
  options: Options;
  sessionId: string;
  account: string;
  done: string[];
}

export async function* fakeWorker(prompt: string, options: Options): AsyncGenerator<object> {
  const { account, cwd, sessionId } = recordCall(options);
  yield { type: "system", subtype: "init", session_id: sessionId };
  if (isSideCall(options)) {
    yield summaryResult(cwd, account, sessionId);
    return;
  }
  const context: StepContext = { options, sessionId, account, done: [] };
  for (const line of prompt.split("\n").map((l) => l.trim())) yield* runStep(line, context);
  const result = `Finished. ${context.done.join("; ")}.`;
  yield { type: "result", subtype: "success", is_error: false, result, total_cost_usd: 0.01, session_id: sessionId };
}

/** A summary or handoff: it runs without asking, and never takes over the session it reads. */
function isSideCall(options: Options): boolean {
  return options.permissionMode === "dontAsk";
}

/** Remembers the call. */
function recordCall(options: Options): { account: string; cwd: string; sessionId: string } {
  const account = accountOf(options.env?.CLAUDE_CONFIG_DIR);
  const cwd = options.cwd ?? "";
  const summary = isSideCall(options);
  workerCalls.push({ cwd, account, resume: options.resume, bin: options.pathToClaudeCodeExecutable, summary });
  const sessionId = options.resume && !summary ? options.resume : `sess-${Math.random().toString(36).slice(2, 8)}`;
  if (!summary) sessionsByCwd.set(cwd, sessionId);
  return { account, cwd, sessionId };
}

function summaryResult(cwd: string, account: string, sessionId: string): object {
  const diff = execSync("git status --short", { cwd, encoding: "utf8" }).trim();
  const result = `Summary for ${cwd.split("/").pop()} (${account}): changed ${diff.replace(/\s+/g, " ")}.`;
  return { type: "result", subtype: "success", is_error: false, result, total_cost_usd: 0.001, session_id: sessionId };
}

async function* runStep(line: string, context: StepContext): AsyncGenerator<object> {
  const [kind, ...rest] = line.split(":");
  const arg = rest.join(":").trim();
  if (kind === "error") yield* failWith(arg, context);
  if (kind === "turn") yield { ...successResult(arg, TURN_COST_USD), session_id: context.sessionId };
  if (kind === "sleep") {
    await abortableSleep(Number(arg), context.options.abortController!.signal);
    context.done.push(`slept ${arg}`);
  }
  if (kind === "run") yield* runCommand(arg, context);
  if (kind === "ask") await askUser(arg, context);
}

/** "Which database?|Postgres,SQLite": one question with those options, sent through canUseTool as Claude Code does. */
async function askUser(spec: string, { options, done }: StepContext): Promise<void> {
  const [question, choices] = spec.split("|");
  const offered = choices.split(",").map((label) => ({ label, description: `Use ${label}` }));
  const input = { questions: [{ question, header: "Choice", multiSelect: false, options: offered }] };
  const signal = options.abortController!.signal;
  const answer = await options.canUseTool!("AskUserQuestion", input, { signal, toolUseID: "t", requestId: "r" });
  done.push(answer?.behavior === "allow" ? `answered ${JSON.stringify(answer.updatedInput?.answers)}` : "not answered");
}

/** An error result, then the same error thrown, as Claude Code does. */
async function* failWith(error: string, context: StepContext): AsyncGenerator<object> {
  yield { ...successResult(error, 0), is_error: true, session_id: context.sessionId };
  throw new Error(`Claude Code returned an error result: ${error}`);
}

function successResult(result: string, costUsd: number): object {
  return { type: "result", subtype: "success", is_error: false, result, total_cost_usd: costUsd };
}

async function* runCommand(command: string, context: StepContext): AsyncGenerator<object> {
  if (!(await isAllowed(command, context))) {
    context.done.push(`denied: ${command}`);
    return;
  }
  const toolUse = { type: "tool_use", name: "Bash", input: { command } };
  yield { type: "assistant", message: { content: [toolUse] }, session_id: context.sessionId };
  execSync(command, { cwd: context.options.cwd });
  context.done.push(`ran: ${command}`);
}

/** PreToolUse hooks first (that's where destructive commands are forced to "ask"), then canUseTool like Claude Code. */
async function isAllowed(command: string, { options, account }: StepContext): Promise<boolean> {
  const forced = await forcedToAsk(command, options);
  if (alwaysAllowed.get(account)?.has(command) && !forced) return true;
  const signal = options.abortController!.signal;
  const answer = await options.canUseTool!(
    "Bash",
    { command },
    { signal, suggestions: [suggestion(command)], toolUseID: "t", requestId: "r" },
  );
  if (!answer || answer.behavior === "deny") return false;
  if (answer.updatedPermissions?.length)
    alwaysAllowed.set(account, (alwaysAllowed.get(account) ?? new Set()).add(command));
  return true;
}

async function forcedToAsk(command: string, options: Options): Promise<boolean> {
  const hooks = (options.hooks?.PreToolUse ?? []).flatMap((matcher) => matcher.hooks);
  const input = preToolUse("Bash", { command });
  const outputs = await Promise.all(
    hooks.map((hook) => hook(input, undefined, { signal: options.abortController!.signal })),
  );
  return outputs.some((output) => decisionOf(output) === "ask");
}

export function preToolUse(toolName: string, toolInput: Record<string, unknown>): PreToolUseHookInput {
  const base = { session_id: "s", transcript_path: "", cwd: "", tool_use_id: "t" };
  return { ...base, hook_event_name: "PreToolUse", tool_name: toolName, tool_input: toolInput };
}

export function decisionOf(output: HookJSONOutput): string | undefined {
  if (!("hookSpecificOutput" in output)) return undefined;
  const specific = output.hookSpecificOutput;
  return specific?.hookEventName === "PreToolUse" ? specific.permissionDecision : undefined;
}

function suggestion(command: string): PermissionUpdate {
  return {
    type: "addRules",
    rules: [{ toolName: "Bash", ruleContent: command }],
    behavior: "allow",
    destination: "session",
  };
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    });
  });
}
