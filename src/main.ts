import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { loadConfig, checkAuth, loginCommand, NOTES_PATH, STATE_DIR } from "./config.js";
import { AssistantNotes } from "./notes.js";
import { DestructiveList } from "./destructive.js";
import { Registry } from "./registry.js";
import { PermissionBroker } from "./permissions.js";
import { CommandExplainer } from "./explainer.js";
import { UsageLimits } from "./usage-limit.js";
import { TodoList } from "./todo.js";
import { WorkerManager } from "./workers.js";
import { Orchestrator } from "./orchestrator.js";
import { MacVoice, TextVoice } from "./voice.js";
import { MacHotkey } from "./hotkey.js";
import { MacScreen } from "./screen.js";
import { ConversationMemory } from "./memory.js";
import { Feed } from "./ui/feed.js";
import { UiServer } from "./ui/server.js";
import { SessionChats } from "./chats.js";
import { RESTART_EXIT_CODE, RESTARTED_ENV } from "./restart.js";

/** Time for workers to stop before the process exits. */
const WORKER_STOP_GRACE_MS = 300;

const cfg = loadConfig();
const TODO_DIR = resolve(STATE_DIR, "todo");
const textMode = process.argv.includes("--text");

// Fail fast on logins instead of hearing "Not logged in" from every session.
if (!process.argv.includes("--skip-auth-check")) {
  console.log(`Claude binary: ${cfg.claudeBin ?? "(SDK bundled)"}`);
  const statuses = await checkAuth(cfg);
  for (const s of statuses)
    console.log(`  ${s.loggedIn ? "✓" : "✗"} ${s.profile.padEnd(10)} ${s.configDir}  ${s.detail}`);
  const bad = statuses.filter((s) => !s.loggedIn);
  for (const s of bad) console.log(`\n  Fix ${s.profile}:  ${loginCommand(s.configDir)}`);
  if (bad.some((s) => s.profile === cfg.orchestrator.profile)) {
    console.log(`\nThe orchestrator account (${cfg.orchestrator.profile}) must be logged in. If you log in under a different folder, fix profiles.${cfg.orchestrator.profile}.configDir in config/config.yaml.`);
    process.exit(1);
  }
  if (bad.length) console.log("\nProjects on a logged-out account will fail until you log in.\n");
}

const destructive = new DestructiveList();
const registry = new Registry(Object.fromEntries(Object.entries(cfg.projects).map(([n, p]) => [n, p.profile])));
const explainer = new CommandExplainer(cfg, registry);
const broker = new PermissionBroker(cfg, registry, destructive, (project, command) => explainer.explain(project, command));
const workers = new WorkerManager(cfg, registry, broker, destructive, new UsageLimits(new TodoList(TODO_DIR), registry));
const voice = textMode ? new TextVoice() : new MacVoice(cfg.voice, new MacHotkey(cfg.voice.hotkey));
const screen = await MacScreen.create();
const notes = new AssistantNotes(NOTES_PATH);
const orchestrator = new Orchestrator(cfg, registry, workers, broker, destructive, voice, screen, new ConversationMemory(), notes);
const feed = new Feed();
feed.follow(orchestrator, registry);
const chats = new SessionChats();
chats.follow(workers, registry);
const ui = new UiServer(cfg, registry, workers, broker, orchestrator, feed, chats);

try {
  const url = await ui.start();
  console.log(`UI: ${url}`);
  if (cfg.ui.open && !process.env[RESTARTED_ENV]) spawn("open", [url], { stdio: "ignore" });
} catch (e) {
  console.error(`[ui] not started: ${(e as Error).message} (set ui.port in config/config.yaml)`);
}

orchestrator.start().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

process.on("SIGINT", () => shutDown(0));
orchestrator.on("restart", () => {
  console.log("Restarting…");
  shutDown(RESTART_EXIT_CODE);
});

function shutDown(exitCode: number) {
  workers.stopAll();
  ui.stop();
  setTimeout(() => process.exit(exitCode), WORKER_STOP_GRACE_MS);
}
