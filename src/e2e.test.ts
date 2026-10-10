/**
 * End-to-end flow test with Claude replaced by scripted fakes.
 *
 * Real: config, project discovery, registry, permission broker, destructive rules,
 *       worker manager, orchestrator queueing/notifications/reset, git in real temp repos,
 *       dummy shell commands actually executed in the project folders.
 * Fake: the two LLMs (orchestrator brain + coding workers) and the microphone/speaker.
 *
 * Each worker call records which CLAUDE_CONFIG_DIR (= which account) it was started with.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, copyFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HookCallback, PermissionResult, PermissionUpdate, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { setStateDir, DESTRUCTIVE_PATH, type AppConfig } from "./config.js";
import { DestructiveList } from "./destructive.js";
import { Registry, type AppEvent } from "./registry.js";
import { PermissionBroker } from "./permissions.js";
import { WorkerManager, type QueryFn } from "./workers.js";
import { Orchestrator } from "./orchestrator.js";
import { ConversationMemory } from "./memory.js";
import { AssistantNotes } from "./notes.js";
import { Feed } from "./ui/feed.js";
import { UiServer } from "./ui/server.js";
import { SessionChats } from "./chats.js";
import { request as httpRequest } from "node:http";
import type { VoiceIO, VoiceInputState } from "./voice.js";
import type { ScreenSource, Screenshot } from "./screen.js";

// ------------------------------------------------------------------ sandbox

const root = mkdtempSync(join(tmpdir(), "vo-e2e-"));
after(() => rmSync(root, { recursive: true, force: true }));
const home = join(root, "home");
const gitInit = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "README.md"), "# " + dir.split("/").pop() + "\n");
  execSync("git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm init", { cwd: dir });
};
gitInit(join(home, "code", "dbadmin"));
gitInit(join(home, "acme", "acme-web"));
gitInit(join(home, "acme", "acme-api")); // a decoy, to check "acme-web" picks the right one
const personalDir = join(root, ".claude-personal");
const workDir = join(root, ".claude-work");
mkdirSync(personalDir);
mkdirSync(workDir);
setStateDir(join(root, "state"));
const destFile = join(root, "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, destFile);

const cfg: AppConfig = {
  orchestrator: { profile: "personal", resetMinutes: 60, rules: ["Call the user captain."], answerWindowSeconds: 0 },
  profiles: { personal: { configDir: personalDir }, work: { configDir: workDir } },
  projects: {},
  searchRoots: [home],
  claudeBin: "/fake/claude",
  voice: { hotkey: "x", recordBin: "x", whisperBin: "x", whisperModel: "x", language: "en", speak: "all", mergeWindowSeconds: 0 },
  ui: { port: 0, open: false },
  permissions: { mode: "ask", reminderMinutes: 60, alwaysDestination: "localSettings" },
};

// ------------------------------------------------------------------ fake coding worker

interface WorkerCall { cwd: string; account: string; resume?: string; bin?: string; summary: boolean }
const workerCalls: WorkerCall[] = [];
const alwaysAllowed = new Map<string, Set<string>>(); // per account: commands allowed "always"
const sessionsByCwd = new Map<string, string>();
const account = (dir?: string) => (dir === personalDir ? "personal" : dir === workDir ? "work" : `?${dir}`);

/**
 * Instruction script, one step per line:
 *   run: <shell command>   -> asks permission like Claude Code does, then really executes it
 *   sleep: <ms>            -> simulates a long step (abortable)
 */
async function* fakeWorker(prompt: string, o: any): AsyncGenerator<any> {
  const acct = account(o.env?.CLAUDE_CONFIG_DIR);
  workerCalls.push({ cwd: o.cwd, account: acct, resume: o.resume, bin: o.pathToClaudeCodeExecutable, summary: !!o.forkSession });
  const sid = o.resume && !o.forkSession ? o.resume : `sess-${Math.random().toString(36).slice(2, 8)}`;
  if (!o.forkSession) sessionsByCwd.set(o.cwd, sid);
  yield { type: "system", subtype: "init", session_id: sid };

  if (o.forkSession) {
    const diff = execSync("git status --short", { cwd: o.cwd, encoding: "utf8" }).trim();
    yield { type: "result", subtype: "success", is_error: false, result: `Summary for ${o.cwd.split("/").pop()} (${acct}): changed ${diff.replace(/\s+/g, " ")}.`, total_cost_usd: 0.001, session_id: sid };
    return;
  }

  const done: string[] = [];
  for (const line of prompt.split("\n").map((l) => l.trim())) {
    const [kind, ...rest] = line.split(":");
    const arg = rest.join(":").trim();
    if (kind === "sleep") {
      await new Promise<void>((res, rej) => {
        const t = setTimeout(res, Number(arg));
        o.abortController.signal.addEventListener("abort", () => (clearTimeout(t), rej(new Error("aborted"))));
      });
      done.push(`slept ${arg}`);
    }
    if (kind === "run") {
      const input = { command: arg };
      // PreToolUse hooks first (that's where destructive commands are forced to "ask")
      let forced = false;
      for (const m of o.hooks?.PreToolUse ?? [])
        for (const h of m.hooks as HookCallback[]) {
          const r: any = await h({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: input } as any, undefined, { signal: o.abortController.signal });
          if (r?.hookSpecificOutput?.permissionDecision === "ask") forced = true;
        }
      const allowed = alwaysAllowed.get(acct)?.has(arg) && !forced;
      if (!allowed) {
        const suggestions: PermissionUpdate[] = [{ type: "addRules", rules: [{ toolName: "Bash", ruleContent: arg }], behavior: "allow", destination: "session" }];
        const res: PermissionResult = await o.canUseTool("Bash", input, { signal: o.abortController.signal, suggestions, toolUseID: "t" });
        if (res.behavior === "deny") { done.push(`denied: ${arg}`); continue; }
        if (res.updatedPermissions?.length) {
          if (!alwaysAllowed.has(acct)) alwaysAllowed.set(acct, new Set());
          alwaysAllowed.get(acct)!.add(arg);
        }
      }
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input }] }, session_id: sid };
      execSync(arg, { cwd: o.cwd });
      done.push(`ran: ${arg}`);
    }
  }
  yield { type: "result", subtype: "success", is_error: false, result: `Finished. ${done.join("; ")}.`, total_cost_usd: 0.01, session_id: sid };
}

// ------------------------------------------------------------------ fake orchestrator brain

let orch!: Orchestrator;
const orchSessions: { account: string; systemPrompt: string; bin?: string; tools: string[]; preToolUse: HookCallback[] }[] = [];
let lastPermission: string | undefined;

const uiNotesSeen: string[] = [];

/** Very small rule-based stand-in for the LLM: maps phrases to the same tool calls the model would make. */
async function brain(raw: string): Promise<string> {
  const notes = raw.match(/^(\[UI\][^\n]*\n)+/)?.[0] ?? "";
  uiNotesSeen.push(...notes.split("\n").filter(Boolean));
  const msg = raw.slice(notes.length);
  const call = (n: string, a: Record<string, unknown> = {}) => orch.callTool(n, a);
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/^\[PERMISSION (p\d+)\] (.*)$/s))) {
    lastPermission = m[1];
    return m[2].includes("DESTRUCTIVE") ? `${m[2]} Say the confirm phrase.` : `${m[2]}. Allow once, always, or deny?`;
  }
  if ((m = msg.match(/^\[EVENT\] (\S+) finished its task\. Worker's closing note: (.*)\nTask \(session \d+\): question:/)))
    return `Short answer from ${m[1]}.\n[SCREEN]\nFull answer: ${m[2]}`;
  if ((m = msg.match(/^\[EVENT\] (\S+) finished/))) return `[SCREEN]\n${m[1]} finished. Want details?`;
  if ((m = msg.match(/^\[EVENT\] (\S+) failed: (.*)/))) return `[SCREEN]\n${m[1]} failed: ${m[2]}`;
  if (msg.startsWith("[SYSTEM] Context reset")) return "Handoff: user wants to be told when acme-web finishes.";
  const u = msg.replace(/^\[USER\] /, "");
  if ((m = u.match(/^explain (.+)$/))) return `Briefly: ${m[1]}.\n[SCREEN]\nIn detail: ${m[1]} works step by step.`;
  if ((m = u.match(/^open (.+) on (\w+)$/))) return call("open_project", { name: m[1], profile: m[2] });
  if ((m = u.match(/^in (\S+) do:\n([\s\S]+)$/))) return call("run_task", { project: m[1], instruction: m[2] });
  if (/^(once|yes|confirm \w+)$/i.test(u)) return call("answer_permission", { id: lastPermission, decision: "once" });
  if (/^always$/i.test(u)) return call("answer_permission", { id: lastPermission, decision: "always" });
  if (/^(deny|no)$/i.test(u)) return call("answer_permission", { id: lastPermission, decision: "deny" });
  if ((m = u.match(/^details (\S+)$/))) return call("summarize_changes", { project: m[1] });
  if ((m = u.match(/^stage (\S+)$/))) return call("git", { project: m[1], args: "add -A" });
  if ((m = u.match(/^push (\S+)/))) return call("git", { project: m[1], args: "push origin main" });
  if ((m = u.match(/^stop (\S+)$/))) return call("stop_task", { project: m[1] });
  if (/^status$/.test(u)) return call("list_projects");
  if ((m = u.match(/^history (\S+)$/))) return call("project_history", { project: m[1] });
  if ((m = u.match(/^new session (\S+)$/))) return call("new_session", { project: m[1] });
  if ((m = u.match(/^sessions (\S+)$/))) return call("list_sessions", { project: m[1] });
  if ((m = u.match(/^switch (\S+) to (\d+)$/))) return call("switch_session", { project: m[1], session: Number(m[2]) });
  if ((m = u.match(/^close (\S+) session (\d+)$/))) return call("close_session", { project: m[1], session: Number(m[2]) });
  if ((m = u.match(/^reset context (notes|nothing)$/))) return call("reset_context", { keep: m[1] });
  if (/^restart yourself$/.test(u)) return call("restart_orchestrator");
  if (/^what's on my screen$/.test(u)) return call("look_at_screen");
  return `I didn't get that: ${u}`;
}

/** Lets the current "slow:" orchestrator turn finish. */
let finishSlowTurn = () => {};

async function* fakeOrchestrator(inbox: AsyncIterable<SDKUserMessage>, o: any): AsyncGenerator<any> {
  const preToolUse = (o.hooks?.PreToolUse ?? []).flatMap((m: { hooks: HookCallback[] }) => m.hooks);
  orchSessions.push({ account: account(o.env?.CLAUDE_CONFIG_DIR), systemPrompt: o.systemPrompt, bin: o.pathToClaudeCodeExecutable, tools: o.tools, preToolUse });
  for await (const m of inbox) {
    if (m.message.content === "[USER] crash") throw new Error("session died");
    const slow = String(m.message.content).match(/^\[USER\] slow: (.+)$/);
    if (slow) {
      // an acknowledgment first, then a tool call that takes until the test lets it finish
      yield { type: "assistant", message: { content: [{ type: "text", text: `On it: ${slow[1]}.` }] } };
      await new Promise<void>((release) => (finishSlowTurn = release));
      yield { type: "assistant", message: { content: [{ type: "text", text: "Done with that." }] } };
      yield { type: "result", subtype: "success", is_error: false, result: "Done with that.", total_cost_usd: 0 };
      continue;
    }
    const reply = await brain(String(m.message.content));
    yield { type: "assistant", message: { content: [{ type: "text", text: reply }] } };
    yield { type: "result", subtype: "success", is_error: false, result: reply, total_cost_usd: 0 };
  }
}

const fakeQuery = ((p: { prompt: any; options: any }) =>
  typeof p.prompt === "string" ? fakeWorker(p.prompt, p.options) : fakeOrchestrator(p.prompt, p.options)) as unknown as QueryFn;

// ------------------------------------------------------------------ fake mic + speaker

class TestVoice implements VoiceIO {
  spoken: string[] = [];
  private cb: (t: string) => void = () => {};
  private pressCb: () => void = () => {};
  listening = false;
  onUtterance(cb: (t: string) => void) { this.cb = cb; }
  onPress(cb: () => void) { this.pressCb = cb; }
  isListening() { return this.listening; }
  inputState(): VoiceInputState { return this.listening ? "recording" : "idle"; }
  async start() {}
  async speak(t: string) { this.spoken.push(t); }
  stopSpeaking() {}
  say(t: string) { this.pressCb(); this.cb(t); }
  /** Wait until something matching `re` is spoken after index `from`. */
  async heard(re: RegExp, from = 0, ms = 4000): Promise<string> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = this.spoken.slice(from).find((s) => re.test(s));
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`Never heard ${re}. Spoken so far:\n  ${this.spoken.join("\n  ")}`);
  }
}

// ------------------------------------------------------------------ fake screen

class TestScreen implements ScreenSource {
  captures = 0;
  capture() { this.captures++; }
  async latest(): Promise<Screenshot> { return { data: "ZmFrZQ==", mimeType: "image/jpeg" }; }
}

// ------------------------------------------------------------------ wiring

const voice = new TestVoice();
const screen = new TestScreen();
const destructive = new DestructiveList(destFile, false);
const registry = new Registry({});
const broker = new PermissionBroker(cfg, registry, destructive);
const workers = new WorkerManager(cfg, registry, broker, destructive, fakeQuery);
const notesFile = join(root, "notes.md");
writeFileSync(notesFile, "# Assistant notes\n\n## Aliases\n\n- dbadmin is also called database admin.\n");
orch = new Orchestrator(cfg, registry, workers, broker, destructive, voice, screen, new ConversationMemory(), new AssistantNotes(notesFile), fakeQuery);
await orch.start();
const feed = new Feed();
feed.follow(orch, registry);
const chats = new SessionChats();
chats.follow(workers, registry);
const ui = new UiServer(cfg, registry, workers, broker, orch, feed, chats);
const uiUrl = new URL(await ui.start());
const uiToken = uiUrl.searchParams.get("token")!;
after(() => ui.stop());

const dbadmin = join(home, "code", "dbadmin");
const acmeWeb = join(home, "acme", "acme-web");
const staged = (dir: string) => execSync("git diff --cached --name-only", { cwd: dir, encoding: "utf8" }).trim();
const log = (dir: string) => execSync("git log --oneline", { cwd: dir, encoding: "utf8" }).trim().split("\n").length;
const mark = () => voice.spoken.length;

// ------------------------------------------------------------------ the flow

test("standing rules from config reach the orchestrator", () => {
  assert.match(orchSessions[0].systemPrompt, /standing rules[^\n]*\n- Call the user captain\./);
});

test("the user's notes reach the orchestrator", () => {
  assert.match(orchSessions[0].systemPrompt, /user's notes[^\n]*\n# Assistant notes[\s\S]*- dbadmin is also called database admin\./);
});

test("remember adds a line to the notes file", async () => {
  await orch.callTool("remember", { note: "acme is the work frontend", section: "Project notes" });
  assert.match(readFileSync(notesFile, "utf8"), /## Project notes\n\n- acme is the work frontend\n/);
});

test("orchestrator runs on the personal account, has no built-in tools, uses the user's claude binary", () => {
  assert.equal(orchSessions[0].account, "personal");
  assert.deepEqual(orchSessions[0].tools, []);
  assert.equal(orchSessions[0].bin, "/fake/claude");
});

test("open two projects by spoken name on different accounts", async () => {
  let i = mark();
  voice.say("open database admin on personal");
  assert.match(await voice.heard(/Opened dbadmin/, i), /personal account/);
  i = mark();
  voice.say("open acme-web on work");
  assert.match(await voice.heard(/Opened acme-web/, i), /work account/);
  assert.equal(cfg.projects.dbadmin.path, dbadmin);
  assert.equal(cfg.projects["acme-web"].path, acmeWeb);
  // remembered for next start
  assert.ok(readFileSync(join(root, "state", "projects.json"), "utf8").includes("acme-web"));
});

test("both workers run in parallel, each on its own account, and ask permission by voice", async () => {
  let i = mark();
  voice.say("in dbadmin do:\nrun: echo hello > dummy.txt\nrun: git add dummy.txt\nrun: git -c user.email=t@t -c user.name=t commit -qm dummy");
  await voice.heard(/Started on dbadmin \(personal account\)/, i);
  await voice.heard(/dbadmin wants approval for Bash: echo hello > dummy.txt/, i);

  // answer once, then the next harmless step
  i = mark();
  voice.say("once");
  await voice.heard(/Allowed once: dbadmin/, i);
  await voice.heard(/dbadmin wants approval for Bash: git add dummy.txt/, i);
  i = mark();
  voice.say("yes");
  await voice.heard(/Allowed once/, i);

  // the commit is destructive: plain "yes" must NOT pass
  const hit = await voice.heard(/DESTRUCTIVE: user must say "confirm commit"/, i);
  assert.match(hit, /dbadmin/);
  i = mark();
  voice.say("yes");
  await voice.heard(/Not approved: destructive/, i);
  assert.equal(log(dbadmin), 1, "nothing committed after a plain yes");

  // start the second project while the first is still waiting
  i = mark();
  voice.say("in acme-web do:\nrun: mkdir -p tmp && echo fe > tmp/dummy-fe.txt\nsleep: 300\nrun: rm -rf tmp");
  await voice.heard(/Started on acme-web \(work account\)/, i);
  await voice.heard(/acme-web wants approval for Bash: mkdir/, i);

  // two permission requests are now pending
  assert.equal(broker.list().length, 2);
  assert.equal(registry.activeSession("dbadmin").status, "waiting_permission");
  assert.equal(registry.activeSession("acme-web").status, "waiting_permission");

  const calls = Object.fromEntries(workerCalls.filter((c) => !c.summary).map((c) => [c.cwd.split("/").pop(), c]));
  assert.equal(calls.dbadmin.account, "personal");
  assert.equal(calls["acme-web"].account, "work");
  assert.equal(calls["acme-web"].cwd, acmeWeb);
  assert.equal(calls.dbadmin.bin, "/fake/claude");
});

test("confirm phrase approves the commit; finished task is announced", async () => {
  // the last announced request is acme-web's mkdir; answer it "always"
  let i = mark();
  voice.say("always");
  await voice.heard(/Allowed permanently: acme-web/, i);

  // now handle dbadmin's commit: the brain tracks the latest permission id, so point it back
  const commitReq = broker.list().find((p) => p.project === "dbadmin")!;
  lastPermission = commitReq.id;
  i = mark();
  voice.say("confirm commit");
  await voice.heard(/Allowed once: dbadmin: Bash: git .*commit/, i);
  await voice.heard(/^dbadmin session \d+ done: /, i);
  assert.equal(log(dbadmin), 2, "commit happened");
  assert.equal(registry.activeSession("dbadmin").status, "done");
});

test("cleanup step (rm -rf) is destructive too and can be denied; worker still finishes", async () => {
  let i = mark();
  await voice.heard(/acme-web wants approval for Bash: rm -rf tmp -- DESTRUCTIVE: user must say "confirm delete"/, 0);
  voice.say("deny");
  await voice.heard(/Denied acme-web/, i);
  await voice.heard(/^acme-web session \d+ done: /, i);
  assert.ok(existsSync(join(acmeWeb, "tmp/dummy-fe.txt")), "denied delete did not run");
  assert.match(registry.activeSession("acme-web").lastResult!, /denied: rm -rf tmp/);
});

test("'always' is remembered per account: same command on work runs without asking, on personal it asks", async () => {
  let i = mark();
  voice.say("in acme-web do:\nrun: mkdir -p tmp && echo fe > tmp/dummy-fe.txt");
  await voice.heard(/^acme-web session \d+ done: /, i);
  assert.ok(!voice.spoken.slice(i).some((s) => /acme-web wants approval/.test(s)), "no prompt on the work account");
  // the worker resumed the same session
  const feCalls = workerCalls.filter((c) => c.cwd === acmeWeb && !c.summary);
  assert.equal(feCalls.at(-1)!.resume, feCalls[0].resume ?? sessionsByCwd.get(acmeWeb));
  assert.ok(feCalls.at(-1)!.resume, "second task resumed the first session");

  i = mark();
  voice.say("in dbadmin do:\nrun: mkdir -p tmp && echo fe > tmp/dummy-fe.txt");
  await voice.heard(/dbadmin wants approval/, i);
  voice.say("deny");
  await voice.heard(/^dbadmin session \d+ done: /, i);
});

test("details: summary is generated on the project's own account (work stays on work)", async () => {
  const i = mark();
  voice.say("details acme-web");
  const s = await voice.heard(/Summary for acme-web/, i);
  assert.match(s, /\(work\)/);
  assert.equal(workerCalls.filter((c) => c.summary).at(-1)!.account, "work");
});

test("'stage and leave as is' stages without committing; push without confirm is refused", async () => {
  let i = mark();
  voice.say("stage acme-web");
  await voice.heard(/Done, no output|tmp/, i);
  assert.equal(staged(acmeWeb), "tmp/dummy-fe.txt");
  assert.equal(log(acmeWeb), 1, "nothing committed");

  i = mark();
  voice.say("push dbadmin");
  await voice.heard(/Destructive \(push\)\. Not run/, i);
});

test("notifications wait until the user has finished speaking", async () => {
  const i = mark();
  voice.say("in dbadmin do:\nsleep: 200");
  await voice.heard(/Started on dbadmin/, i);
  voice.listening = true; // key held, or words still being transcribed
  await new Promise((r) => setTimeout(r, 500)); // task finished meanwhile
  assert.ok(!voice.spoken.slice(i).some((s) => /^dbadmin session \d+ done: /.test(s)), "not spoken while user is talking");
  voice.listening = false;
  await voice.heard(/^dbadmin session \d+ done: /, i);
});

test("stop a long task: queue cleared, status stopped, nothing left pending", async () => {
  let i = mark();
  voice.say("in acme-web do:\nsleep: 10000");
  await voice.heard(/Started on acme-web/, i);
  voice.say("in acme-web do:\nrun: echo queued > q.txt");
  await voice.heard(/queued as #1/, i);
  i = mark();
  voice.say("stop acme-web");
  await voice.heard(/Stopping acme-web; its queue was cleared/, i);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(registry.activeSession("acme-web").status, "stopped");
  assert.equal(existsSync(join(acmeWeb, "q.txt")), false, "queued task never ran");
  assert.equal(broker.list().length, 0);
});

test("starting to talk snaps the screen", () => {
  const before = screen.captures;
  voice.say("status");
  assert.equal(screen.captures, before + 1);
});

test("look_at_screen hands the screenshot to the model", async () => {
  const i = mark();
  voice.say("what's on my screen");
  assert.match(await voice.heard(/screen when they started speaking/, i), /\[image\]/);
});

test("hourly context reset carries a handoff into the new session", async () => {
  cfg.orchestrator.resetMinutes = 0;
  const before = orchSessions.length;
  const i = mark();
  voice.say("status");
  await voice.heard(/dbadmin \[personal\]: done[\s\S]*acme-web \[work\]: stopped/, i);
  const end = Date.now() + 3000;
  while (orchSessions.length === before && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
  const s = orchSessions.at(-1)!;
  assert.equal(orchSessions.length, before + 1);
  assert.match(s.systemPrompt, /Handoff: user wants to be told when acme-web finishes/);
  assert.match(s.systemPrompt, /acme-web \[work\]/);
  assert.equal(s.account, "personal");
  cfg.orchestrator.resetMinutes = 60;
});

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const countSince = (i: number, re: RegExp) => voice.spoken.slice(i).filter((s) => re.test(s)).length;
/** Wait until `re` has been spoken `times` times since index `from`. */
async function heardTimes(re: RegExp, times: number, from: number, ms = 4000) {
  const end = Date.now() + ms;
  while (countSince(from, re) < times && Date.now() < end) await pause(20);
  assert.equal(countSince(from, re), times, `expected ${re} ${times} times`);
}

test("two permission requests are asked one at a time", async () => {
  const i = mark();
  voice.listening = true; // both arrive while the user is talking
  workers.run("dbadmin", "run: echo a");
  workers.run("acme-web", "run: echo b");
  while (broker.list().length < 2) await pause(20);
  voice.listening = false;
  assert.match(await voice.heard(/wants approval/, i), /\(1 more waiting\)/);
  await pause(300);
  assert.equal(countSince(i, /wants approval/), 1, "second request waits for an answer to the first");
  voice.say("deny");
  await heardTimes(/wants approval/, 2, i);
  voice.say("deny");
  await heardTimes(/^\S+ session \d+ done: /, 2, i);
});

test("after 'want details?', the next notification waits for the answer window", async () => {
  cfg.orchestrator.answerWindowSeconds = 1;
  const i = mark();
  workers.run("dbadmin", "sleep: 10");
  workers.run("acme-web", "sleep: 10");
  await heardTimes(/^\S+ session \d+ done: /, 1, i);
  await pause(400);
  assert.equal(countSince(i, /^\S+ session \d+ done: /), 1, "held inside the window");
  await heardTimes(/^\S+ session \d+ done: /, 2, i);
  cfg.orchestrator.answerWindowSeconds = 0;
});

test("speaking ends the answer window early", async () => {
  cfg.orchestrator.answerWindowSeconds = 60;
  const i = mark();
  workers.run("dbadmin", "sleep: 10");
  workers.run("acme-web", "sleep: 10");
  await heardTimes(/^\S+ session \d+ done: /, 1, i);
  voice.say("status");
  await heardTimes(/^\S+ session \d+ done: /, 2, i);
  cfg.orchestrator.answerWindowSeconds = 0;
});

test("a finished task is announced with its session number and a few words of the task", async () => {
  const before = mark();
  voice.say("status"); // answers the last "want details?", so the next announcement isn't held back
  await voice.heard(/dbadmin \[personal\]/, before);
  const i = mark();
  workers.run("dbadmin", "Please add a resend countdown on sign-up.\nsleep: 5");
  const number = registry.activeSession("dbadmin").number;
  await voice.heard(new RegExp(`^dbadmin session ${number} done: add a resend countdown on sign-up$`), i);
});

test("a finished-task event carries the task text and session number", async () => {
  const ended = new Promise<AppEvent>((ok) => registry.once("event", ok));
  workers.run("dbadmin", "sleep: 5");
  const event = await ended;
  assert.deepEqual(event.kind === "task_done" && [event.task, event.sessionNumber], ["sleep: 5", registry.activeSession("dbadmin").number]);
});

test("a failed task is announced with its session number and a few words of the task", async () => {
  const i = mark();
  const session = registry.activeSession("dbadmin");
  registry.emitEvent({ kind: "task_failed", project: "dbadmin", session: session.id, label: "dbadmin", task: "Fix the login redirect loop", sessionNumber: session.number, error: "boom" });
  await voice.heard(new RegExp(`^dbadmin session ${session.number} failed: Fix the login redirect loop$`), i);
});

test("the assistant's acknowledgment is spoken before its tool calls finish", async () => {
  const i = mark();
  voice.say("slow: check webshop");
  await voice.heard(/^On it: check webshop\.$/, i);
  finishSlowTurn();
  await voice.heard(/^Done with that\.$/, i);
});

test("a reply spoken piece by piece is not spoken again whole", async () => {
  const i = mark();
  voice.say("slow: check dbadmin");
  await voice.heard(/^On it: check dbadmin\.$/, i);
  finishSlowTurn();
  await voice.heard(/^Done with that\.$/, i);
  await pause(200);
  assert.equal(countSince(i, /On it: check dbadmin\. Done with that\./), 0);
});

const uiPost = (path: string, body: unknown, token = uiToken) =>
  fetch(new URL(path, uiUrl), { method: "POST", headers: { "content-type": "application/json", "x-token": token }, body: JSON.stringify(body) });

async function feedHas(re: RegExp, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = feed.recent().find((e) => re.test(e.text));
    if (hit) return hit;
    await pause(20);
  }
  throw new Error(`Feed never showed ${re}`);
}

test("ui: the page needs the token from the printed link", async () => {
  assert.equal((await fetch(new URL("/", uiUrl))).status, 401);
  assert.equal((await fetch(uiUrl)).status, 200);
});

test("ui: actions need the token", async () => {
  assert.equal((await uiPost("/api/message", { text: "status" }, "wrong")).status, 401);
});

test("ui: requests for another host name are refused (DNS rebinding)", async () => {
  const status = await new Promise<number>((ok) =>
    httpRequest({ host: "127.0.0.1", port: uiUrl.port, path: uiUrl.pathname + uiUrl.search, headers: { host: "evil.example" } }, (r) => ok(r.statusCode!)).end());
  assert.equal(status, 403);
});

test("ui: a typed message is answered in the feed, not spoken", async () => {
  const i = mark();
  assert.equal((await uiPost("/api/message", { text: "status" })).status, 200);
  await feedHas(/dbadmin \[personal\]/);
  await pause(100);
  assert.equal(voice.spoken.length, i);
});

test("ui: a destructive request is allowed once by click, never 'always'", async () => {
  workers.run("dbadmin", "run: mkdir -p tmpx && rm -rf tmpx");
  while (!broker.requests().some((r) => r.destructiveVerb === "delete")) await pause(20);
  const id = broker.requests()[0].id;
  assert.match(await (await uiPost(`/api/permissions/${id}`, { decision: "always" })).text(), /can't be always-allowed/);
  assert.match(await (await uiPost(`/api/permissions/${id}`, { decision: "once" })).text(), /Allowed once/);
  await feedHas(/^finished its task$/);
});

test("ui: what you click is passed to the model with its next message", async () => {
  await uiPost("/api/message", { text: "status" });
  await pause(200);
  assert.ok(uiNotesSeen.some((n) => /^\[UI\] Allowed once: dbadmin: Bash: mkdir -p tmpx && rm -rf tmpx \(request p\d+\)$/.test(n)), uiNotesSeen.join("\n"));
});

/** Runs a short acme-web task and returns once the model's reply about it is in the feed. */
async function finishAcmeWebTask() {
  const before = feed.recent().length;
  workers.run("acme-web", "sleep: 10");
  while (!feed.recent().slice(before).some((e) => e.kind === "orchestrator" && /acme-web finished/.test(e.text))) await pause(20);
  await pause(100);
}

test("a finished task's longer reply is shown, not spoken", async () => {
  const i = mark();
  await finishAcmeWebTask();
  assert.equal(countSince(i, /acme-web finished/), 0);
});

/** Runs a question on acme-web and waits until the assistant's answer is in the feed. */
async function answerQuestionOnAcmeWeb(): Promise<number> {
  const i = mark();
  workers.run("acme-web", "question: how does login work\nsleep: 10");
  await feedHas(/Full answer: Finished/);
  return i;
}

test("a worker's answer to a question is spoken briefly", async () => {
  const i = await answerQuestionOnAcmeWeb();
  await voice.heard(/^Short answer from acme-web\.$/, i);
});

test("a worker's answer's full explanation is not spoken", async () => {
  const i = await answerQuestionOnAcmeWeb();
  await voice.heard(/^Short answer from acme-web\.$/, i);
  assert.equal(countSince(i, /Full answer/), 0);
});

test("a worker's answer shows the brief and the full explanation on screen", async () => {
  await answerQuestionOnAcmeWeb();
  assert.match(feed.recent().at(-1)!.text, /^Short answer from acme-web\.\n\nFull answer: Finished/);
});

test("a voice reply speaks only its part before [SCREEN]", async () => {
  const i = mark();
  voice.say("explain the queue");
  await feedHas(/In detail: the queue works step by step\./);
  assert.deepEqual(voice.spoken.slice(i).filter((s) => /queue/.test(s)), ["Briefly: the queue."]);
});

test("ui: in 'questions' speech mode a finished task is still announced", async () => {
  orch.setSpeechMode("questions");
  const i = mark();
  await finishAcmeWebTask();
  assert.equal(countSince(i, /^acme-web session \d+ done: /), 1);
  orch.setSpeechMode("all");
});

test("ui: in 'muted' speech mode a finished task is not announced", async () => {
  orch.setSpeechMode("muted");
  const i = mark();
  await finishAcmeWebTask();
  assert.equal(countSince(i, /^acme-web session \d+ done: /), 0);
  orch.setSpeechMode("all");
});

test("ui: live state streams to the page", async () => {
  const res = await fetch(new URL(`/api/events?token=${uiToken}`, uiUrl));
  const reader = res.body!.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  assert.match(new TextDecoder().decode(value), /^event: state\ndata: \{"projects":\[/);
});

test("finished tasks are kept in project history", async () => {
  const i = mark();
  voice.say("history dbadmin");
  assert.match(await voice.heard(/\[done\]/, i), /echo hello > dummy\.txt/);
});

test("user-requested fresh reset drops the conversation but keeps project history", async () => {
  const before = orchSessions.length;
  const i = mark();
  voice.say("reset context nothing");
  await voice.heard(/starting fresh/, i);
  const end = Date.now() + 3000;
  while (orchSessions.length === before && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
  const s = orchSessions.at(-1)!;
  assert.equal(orchSessions.length, before + 1);
  assert.doesNotMatch(s.systemPrompt, /Handoff|Last exchanges/);
  assert.match(s.systemPrompt, /Recent tasks per project[\s\S]*dbadmin:/);
});

test("asking for a restart speaks the confirmation first, then asks the app to restart", async () => {
  const i = mark();
  const restarted = new Promise<number>((r) => orch.once("restart", () => r(voice.spoken.length)));
  voice.say("restart yourself");
  const spokenWhenRestarted = await restarted;
  assert.match(voice.spoken.slice(i, spokenWhenRestarted).join(" "), /will restart/);
});

/** What the operator's own PreToolUse hooks decide for a calendar call made while the user said `utterance`. */
async function operatorDecision(tool: string, utterance: string): Promise<string | undefined> {
  const input = { hook_event_name: "PreToolUse", tool_name: `mcp__claude_ai_Google_Calendar__${tool}`, tool_input: { eventId: "e1" } } as any;
  const outputs = await orch.withUtterance(utterance, () =>
    Promise.all(orchSessions.at(-1)!.preToolUse.map((hook) => hook(input, "t", { signal: new AbortController().signal }))));
  return outputs.map((o: any) => o.hookSpecificOutput?.permissionDecision).find(Boolean);
}

test("calendar: deleting an event without 'confirm delete' is refused", async () => {
  assert.equal(await operatorDecision("delete_event", "yes, delete it"), "deny");
});

test("calendar: deleting an event after 'confirm delete' goes ahead", async () => {
  assert.equal(await operatorDecision("delete_event", "confirm delete"), undefined);
});

test("calendar: changing an event without 'confirm update' is refused", async () => {
  assert.equal(await operatorDecision("update_event", "yes, add the reminder"), "deny");
});

test("calendar: changing an event after 'confirm update' goes ahead", async () => {
  assert.equal(await operatorDecision("update_event", "confirm update"), undefined);
});

test("calendar: creating an event needs no confirm phrase", async () => {
  assert.equal(await operatorDecision("create_event", "add dentist on friday at 3"), undefined);
});

test("a crashed session restarts after a wait; what you say meanwhile is answered by the new one", async () => {
  const before = orchSessions.length;
  const i = mark();
  voice.say("crash");
  await voice.heard(/session crashed/, i);
  voice.say("history dbadmin");
  await pause(300);
  assert.equal(orchSessions.length, before);
  assert.match(await voice.heard(/\[done\]/, i), /echo hello > dummy\.txt/);
  assert.equal(orchSessions.length, before + 1);
});

test("sessions: a new session is active and starts its own worker conversation", async () => {
  const i = mark();
  voice.say("new session dbadmin");
  await voice.heard(/Opened dbadmin session 2; it is now active/, i);
  voice.say("in dbadmin do:\nrun: echo second");
  await voice.heard(/dbadmin session 2 wants approval for Bash: echo second/, i);
  assert.equal(workerCalls.filter((c) => c.cwd === dbadmin && !c.summary).at(-1)!.resume, undefined);
});

test("sessions: listed with the active one marked", async () => {
  const i = mark();
  voice.say("sessions dbadmin");
  assert.match(await voice.heard(/session 1:/, i), /session 2 \(active\): waiting_permission/);
});

test("sessions: switching back routes tasks to the first session", async () => {
  const i = mark();
  voice.say("switch dbadmin to 1");
  await voice.heard(/dbadmin session 1 is now active/, i);
  assert.equal(registry.activeSession("dbadmin").number, 1);
});

test("sessions: closing a busy session stops its worker and forgets it", async () => {
  const i = mark();
  voice.say("close dbadmin session 2");
  await voice.heard(/Closed dbadmin session 2/, i);
  assert.deepEqual(
    { sessions: registry.sessionsOf("dbadmin").length, busy: workers.isBusy("dbadmin"), pending: broker.list().length },
    { sessions: 1, busy: false, pending: 0 },
  );
});

test("ui: sessions can be opened, switched and closed by click", async () => {
  assert.equal((await uiPost("/api/projects/dbadmin/sessions", {})).status, 200);
  const second = registry.activeSession("dbadmin");
  const first = registry.sessionByNumber("dbadmin", 1);
  assert.equal((await uiPost(`/api/sessions/${first.id}/activate`, {})).status, 200);
  assert.equal((await uiPost(`/api/sessions/${second.id}/close`, {})).status, 200);
  assert.deepEqual(registry.sessionsOf("dbadmin").map((s) => s.id), [first.id]);
});

/** Wait until a session's chat has a message matching `re`. */
async function chatHas(sessionId: string, re: RegExp, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (chats.messagesOf(sessionId).some((m) => re.test(m.text))) return;
    await pause(20);
  }
  throw new Error(`Chat of ${sessionId} never showed ${re}`);
}
const chatText = (sessionId: string) => chats.messagesOf(sessionId).map((m) => m.text).join("\n");

test("chats: each project keeps its own message history", async () => {
  const dbadminSession = registry.activeSession("dbadmin").id;
  workers.run("dbadmin", "sleep: 5");
  await chatHas(dbadminSession, /^Finished\.$/);
  assert.doesNotMatch(chatText(registry.activeSession("acme-web").id), /sleep: 5/);
});

test("chats: sessions of one project keep separate histories", async () => {
  const first = registry.activeSession("dbadmin").id;
  const second = registry.createSession("dbadmin").id;
  workers.run("dbadmin", "sleep: 6");
  await chatHas(second, /^Finished\.$/);
  assert.deepEqual([/sleep: 6/.test(chatText(first)), chats.messagesOf(second)[0].text], [false, "sleep: 6"]);
});

test("ui: a session's messages are served to the page", async () => {
  const session = registry.activeSession("dbadmin").id;
  const res = await fetch(new URL(`/api/sessions/${session}/messages?token=${uiToken}`, uiUrl));
  assert.equal(((await res.json()) as { text: string }[])[0].text, "sleep: 6");
});

test("chats: a session's messages survive a restart", () => {
  const session = registry.activeSession("dbadmin").id;
  assert.equal(new SessionChats().messagesOf(session)[0].text, "sleep: 6");
});

/** A session with one finished task, then cleared by click. */
async function clearedSession(): Promise<string> {
  const session = registry.createSession("acme-web").id;
  workers.runInSession(session, "sleep: 7");
  await chatHas(session, /^Finished\.$/);
  await uiPost(`/api/sessions/${session}/clear`, {});
  return session;
}

test("ui: clearing a session deletes its message history", async () => {
  const session = await clearedSession();
  assert.equal(existsSync(join(root, "state", "chats", `${session}.json`)), false);
});

test("ui: clearing a session keeps it open", async () => {
  assert.equal(registry.hasSession(await clearedSession()), true);
});

test("chats: closing a session deletes its message history", async () => {
  const session = registry.activeSession("dbadmin").id;
  await workers.closeSession(session);
  assert.equal(existsSync(join(root, "state", "chats", `${session}.json`)), false);
});

test("ui: clearing the assistant empties its chat", async () => {
  await uiPost("/api/message", { text: "status" });
  await feedHas(/dbadmin \[personal\]/);
  assert.equal((await uiPost("/api/assistant/clear", {})).status, 200);
  assert.equal(feed.recent().length, 0);
});

test("ui: clearing the assistant saves its summary before the chat empties", async () => {
  await uiPost("/api/message", { text: "status" });
  await feedHas(/dbadmin \[personal\]/);
  let recapWhenCleared = "";
  feed.once("cleared", () => (recapWhenCleared = new ConversationMemory().recap()));
  await uiPost("/api/assistant/clear", {});
  assert.match(recapWhenCleared, /Handoff: user wants to be told when acme-web finishes/);
});

test("ui: clearing the assistant carries a summary into its new context", async () => {
  const before = orchSessions.length;
  await uiPost("/api/assistant/clear", {});
  const end = Date.now() + 3000;
  while (orchSessions.length === before && Date.now() < end) await pause(20);
  assert.match(orchSessions.at(-1)!.systemPrompt, /Handoff: user wants to be told when acme-web finishes/);
});

test("ui: clearing the assistant drops the earlier exchanges from its new context", () => {
  assert.doesNotMatch(orchSessions.at(-1)!.systemPrompt, /Last exchanges/);
});

test("ui: clearing the assistant saves the summary for after a restart", () => {
  assert.match(new ConversationMemory().recap(), /Handoff: user wants to be told when acme-web finishes/);
});

test("ui: clearing the assistant keeps project history", async () => {
  const i = mark();
  voice.say("history dbadmin");
  assert.match(await voice.heard(/\[done\]/, i), /echo hello > dummy\.txt/);
});

test("cleanup: remove dummy files from both repos", () => {
  execSync("git reset -q && rm -rf tmp", { cwd: acmeWeb });
  execSync("git reset -q --hard HEAD~1 && rm -rf tmp", { cwd: dbadmin });
  assert.equal(execSync("git status --short", { cwd: acmeWeb, encoding: "utf8" }), "");
  assert.equal(execSync("git status --short", { cwd: dbadmin, encoding: "utf8" }), "");
  assert.equal(log(dbadmin), 1);
});

after(() => {
  console.log("\n--- spoken during the run ---\n" + voice.spoken.map((s) => "🔊 " + s.replace(/\n/g, " ")).join("\n"));
  setTimeout(() => process.exit(0), 50);
});
