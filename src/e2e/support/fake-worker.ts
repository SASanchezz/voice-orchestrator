import { execSync } from "node:child_process";
import type { HookJSONOutput, Options, PermissionUpdate, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import { accountOf } from "./sandbox.js";

/**
 * A scripted Claude Code worker. Its instruction is a script, one step per line:
 *   run: <shell command>   -> asks permission like Claude Code does, then really executes it
 *   sleep: <ms>            -> simulates a long step (abortable)
 *   error: <text>          -> ends with an error result, then throws it again, as Claude Code does
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
  if (options.forkSession) {
    yield summaryResult(cwd, account, sessionId);
    return;
  }
  const context: StepContext = { options, sessionId, account, done: [] };
  for (const line of prompt.split("\n").map((l) => l.trim())) yield* runStep(line, context);
  const result = `Finished. ${context.done.join("; ")}.`;
  yield { type: "result", subtype: "success", is_error: false, result, total_cost_usd: 0.01, session_id: sessionId };
}

/** Remembers the call; a summary is a fork, so it never takes over the session it reads. */
function recordCall(options: Options): { account: string; cwd: string; sessionId: string } {
  const account = accountOf(options.env?.CLAUDE_CONFIG_DIR);
  const cwd = options.cwd ?? "";
  const summary = !!options.forkSession;
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
  if (kind === "error") {
    yield {
      type: "result",
      subtype: "success",
      is_error: true,
      result: arg,
      total_cost_usd: 0,
      session_id: context.sessionId,
    };
    throw new Error(`Claude Code returned an error result: ${arg}`);
  }
  if (kind === "sleep") {
    await abortableSleep(Number(arg), context.options.abortController!.signal);
    context.done.push(`slept ${arg}`);
  }
  if (kind === "run") yield* runCommand(arg, context);
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
