import type { HookCallback, Options, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { OperatorTools } from "../../orchestrator/tools/operator-tools.js";
import { asText } from "../../shared/text.js";
import { accountOf } from "./sandbox.js";

/** What each operator session was started with. */
export interface OperatorSessionStart {
  account: string;
  /** The prompt the main thread runs with: its agent's when it has one, as in the SDK. */
  systemPrompt: string;
  /** The agent the main thread runs as. */
  agent?: string;
  bin?: string;
  tools: unknown;
  preToolUse: HookCallback[];
}

export const operatorSessions: OperatorSessionStart[] = [];

/** What the scripted brain remembers between turns, and what tests steer. */
export const brain = {
  /** The permission id the brain answers; tests may point it at another request. */
  lastPermission: undefined as string | undefined,
  /** "[UI] ..." and "[NOTICE] ..." lines that arrived ahead of a message. */
  notesSeen: [] as string[],
  /** Lets the current "slow:" turn finish. */
  finishSlowTurn: (): void => {},
};

let tools: OperatorTools | undefined;

/** The brain acts through the operator's real tools, once they are built. */
export function connectBrain(operatorTools: OperatorTools): void {
  tools = operatorTools;
}

type Rule = [RegExp, (m: RegExpMatchArray) => string | Promise<string>];

const call = (name: string, args: Record<string, unknown> = {}): Promise<string> => tools!.callTool(name, args);

/** Notifications, by the message the operator receives. */
const NOTIFICATION_RULES: Rule[] = [
  [/^\[PERMISSION (p\d+)\] (.*)$/s, (m) => askAboutPermission(m[1], m[2])],
  [
    /^\[EVENT\] (\S+) finished its task\. Worker's closing note: (.*)\nTask \(session \d+\): question:/,
    (m) => `Short answer from ${m[1]}.\n[SCREEN]\nFull answer: ${m[2]}`,
  ],
  [/^\[EVENT\] (\S+) finished/, (m) => `[SCREEN]\n${m[1]} finished. Want details?`],
  [/^\[EVENT\] (\S+) failed: (.*)/, (m) => `[SCREEN]\n${m[1]} failed: ${m[2]}`],
  [/^\[SYSTEM\] Context reset/, () => "Handoff: user wants to be told when acme-web finishes."],
];

/** Your words, mapped to the same tool calls the model would make. */
const USER_RULES: Rule[] = [
  [/^explain (.+)$/, (m) => `Briefly: ${m[1]}.\n[SCREEN]\nIn detail: ${m[1]} works step by step.`],
  [/^open (.+) on (\w+)$/, (m) => call("open_project", { name: m[1], profile: m[2] })],
  [/^in (\S+) do:\n([\s\S]+)$/, (m) => call("run_task", { project: m[1], instruction: m[2] })],
  [/^remove (\S+)(, confirm remove)?$/, (m) => call("remove_project", { project: m[1] })],
  [/^stop and remove (\S+), confirm remove$/, (m) => call("remove_project", { project: m[1], stopRunning: true })],
  [/^(once|yes|confirm \w+)$/i, () => call("answer_permission", { id: brain.lastPermission, decision: "once" })],
  [/^always$/i, () => call("answer_permission", { id: brain.lastPermission, decision: "always" })],
  [/^(deny|no)$/i, () => call("answer_permission", { id: brain.lastPermission, decision: "deny" })],
  [/^details (\S+)$/, (m) => call("summarize_changes", { project: m[1] })],
  [/^stage (\S+)$/, (m) => call("git", { project: m[1], args: "add -A" })],
  [/^push (\S+)/, (m) => call("git", { project: m[1], args: "push origin main" })],
  [/^stop (\S+)$/, (m) => call("stop_task", { project: m[1] })],
  [/^stop (\S+) session (\d+)$/, (m) => call("stop_task", { project: m[1], session: Number(m[2]) })],
  [/^queue of (\S+)$/, (m) => call("list_queued_tasks", { project: m[1] })],
  [/^drop #(\d+) from (\S+)$/, (m) => call("remove_queued_task", { project: m[2], place: Number(m[1]) })],
  [/^drop "(.+)" from (\S+)$/, (m) => call("remove_queued_task", { project: m[2], match: m[1] })],
  [/^status$/, () => call("list_projects")],
  [/^history (\S+)$/, (m) => call("project_history", { project: m[1] })],
  [/^new session (\S+)$/, (m) => call("new_session", { project: m[1] })],
  [/^sessions (\S+)$/, (m) => call("list_sessions", { project: m[1] })],
  [/^switch (\S+) to (\d+)$/, (m) => call("switch_session", { project: m[1], session: Number(m[2]) })],
  [/^close (\S+) session (\d+)$/, (m) => call("close_session", { project: m[1], session: Number(m[2]) })],
  [/^reset context (notes|nothing)$/, (m) => call("reset_context", { keep: m[1] })],
  [/^restart yourself$/, () => call("restart_orchestrator")],
  [/^what's on my screen$/, () => call("look_at_screen")],
  [/^read this\n\nAttached files:\n- (\S+)/, (m) => call("read_attachment", { path: m[1] })],
  [/^list todo$/, () => call("list_todo")],
  [/^run todo (\S+)$/, (m) => call("run_todo", { id: m[1] })],
];

function askAboutPermission(id: string, request: string): string {
  brain.lastPermission = id;
  return request.includes("DESTRUCTIVE")
    ? `${request} Say the confirm phrase.`
    : `${request}. Allow once, always, or deny?`;
}

/** Very small rule-based stand-in for the LLM. */
async function reply(raw: string): Promise<string> {
  const notes = raw.match(/^(\[(UI|NOTICE)\][^\n]*\n)+/)?.[0] ?? "";
  brain.notesSeen.push(...notes.split("\n").filter(Boolean));
  const message = raw.slice(notes.length);
  const notification = await applyRules(NOTIFICATION_RULES, message);
  if (notification !== undefined) return notification;
  const words = message.replace(/^\[USER\] /, "");
  return (await applyRules(USER_RULES, words)) ?? `I didn't get that: ${words}`;
}

async function applyRules(rules: Rule[], text: string): Promise<string | undefined> {
  for (const [pattern, answer] of rules) {
    const match = text.match(pattern);
    if (match) return answer(match);
  }
  return undefined;
}

export async function* fakeOperator(inbox: AsyncIterable<SDKUserMessage>, options: Options): AsyncGenerator<object> {
  recordStart(options);
  for await (const message of inbox) {
    yield { type: "system", subtype: "init", agents: Object.keys(options.agents ?? {}) }; // as the SDK does each turn
    const content = asText(message.message.content);
    if (content === "[USER] crash") throw new Error("session died");
    const slow = content.match(/^\[USER\] slow: (.+)$/);
    if (slow) yield* slowTurn(slow[1]);
    else yield* turn(await reply(content));
  }
}

function recordStart(options: Options): void {
  const preToolUse = (options.hooks?.PreToolUse ?? []).flatMap((matcher) => matcher.hooks);
  const agentPrompt = options.agent ? options.agents?.[options.agent]?.prompt : undefined;
  const systemPrompt = agentPrompt ?? (typeof options.systemPrompt === "string" ? options.systemPrompt : "");
  const account = accountOf(options.env?.CLAUDE_CONFIG_DIR);
  operatorSessions.push({
    account,
    systemPrompt,
    agent: options.agent,
    bin: options.pathToClaudeCodeExecutable,
    tools: options.tools,
    preToolUse,
  });
}

function* turn(text: string): Generator<object> {
  yield { type: "assistant", message: { content: [{ type: "text", text }] } };
  yield { type: "result", subtype: "success", is_error: false, result: text, total_cost_usd: 0 };
}

/** An acknowledgment first, then a tool call that takes until the test lets it finish. */
async function* slowTurn(task: string): AsyncGenerator<object> {
  yield { type: "assistant", message: { content: [{ type: "text", text: `On it: ${task}.` }] } };
  await new Promise<void>((release) => (brain.finishSlowTurn = release));
  yield { type: "assistant", message: { content: [{ type: "text", text: "Done with that." }] } };
  yield { type: "result", subtype: "success", is_error: false, result: "Done with that.", total_cost_usd: 0 };
}
