import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const run = promisify(execFile);

export const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_PATH = resolve(APP_DIR, "config/config.yaml");
export const DESTRUCTIVE_PATH = resolve(APP_DIR, "config/destructive.yaml");
export const NOTES_PATH = resolve(APP_DIR, "config/notes.md");
export let STATE_DIR = process.env.VO_STATE_DIR ?? resolve(APP_DIR, "state");
export const setStateDir = (d: string) => (STATE_DIR = d);

export interface ProjectConfig {
  path: string;
  profile: string;
  model?: string;
}

/** auto: workers run everything except destructive commands without asking; ask: every request goes to you. */
export type PermissionMode = "auto" | "ask";

/** all: every notification is spoken; questions: only permission requests, short task done/failed notices and replies to your voice; muted: nothing. */
export type SpeechMode = "all" | "questions" | "muted";

export interface AppConfig {
  orchestrator: { profile: string; model?: string; resetMinutes: number; rules: string[]; answerWindowSeconds: number };
  profiles: Record<string, { configDir: string }>;
  projects: Record<string, ProjectConfig>;
  claudeBin?: string; // resolved absolute path, or undefined = SDK's bundled binary
  searchRoots: string[];
  voice: {
    hotkey: string;
    recordBin: string;
    whisperBin: string;
    whisperModel: string;
    language: string;
    sayVoice?: string;
    sayRate?: number;
    speak: SpeechMode;
    /** Recordings started within this many seconds of the previous one's end are sent as one message. */
    mergeWindowSeconds: number;
  };
  ui: { port: number; open: boolean };
  permissions: {
    mode: PermissionMode;
    reminderMinutes: number;
    alwaysDestination: "localSettings" | "projectSettings" | "userSettings" | "session";
  };
}

export const expandHome = (p: string) => (p.startsWith("~") ? homedir() + p.slice(1) : p);
const overlayPath = () => resolve(STATE_DIR, "projects.json");

export function loadConfig(path = CONFIG_PATH): AppConfig {
  const cfg = YAML.parse(readFileSync(path, "utf8")) as AppConfig & { claudeBin?: string };
  cfg.projects ??= {};
  for (const p of Object.values(cfg.profiles)) p.configDir = expandHome(p.configDir);
  for (const p of Object.values(cfg.projects)) p.path = expandHome(p.path);
  cfg.voice.whisperModel = expandHome(cfg.voice.whisperModel);
  cfg.orchestrator.resetMinutes ??= 60;
  cfg.orchestrator.rules ??= [];
  cfg.orchestrator.answerWindowSeconds ??= 15;
  cfg.voice.speak ??= "questions";
  cfg.voice.mergeWindowSeconds ??= 1.5;
  cfg.ui ??= { port: 4777, open: true };
  cfg.ui.port ??= 4777;
  cfg.ui.open ??= true;
  cfg.permissions ??= { mode: "ask", reminderMinutes: 5, alwaysDestination: "localSettings" };
  cfg.permissions.mode ??= "ask";
  cfg.searchRoots = (cfg.searchRoots ?? ["~"]).map((r) => expandHome(r ?? "~")); // bare ~ in YAML is null
  cfg.claudeBin = resolveClaudeBin(cfg.claudeBin);

  // projects added by voice
  if (existsSync(overlayPath())) Object.assign(cfg.projects, JSON.parse(readFileSync(overlayPath(), "utf8")));

  if (!cfg.profiles[cfg.orchestrator.profile])
    throw new Error(`orchestrator.profile "${cfg.orchestrator.profile}" is not in profiles`);
  for (const [name, p] of Object.entries(cfg.projects))
    if (!cfg.profiles[p.profile]) throw new Error(`project ${name}: unknown profile "${p.profile}"`);
  return cfg;
}

function resolveClaudeBin(setting: string | undefined): string | undefined {
  if (setting && setting !== "auto") return expandHome(setting);
  try {
    // login shell so Homebrew / ~/.local/bin / nvm paths are found even when started from an IDE
    return execFileSync(process.env.SHELL || "/bin/zsh", ["-lc", "command -v claude"], { encoding: "utf8" }).trim().split("\n").pop() || undefined;
  } catch {
    return undefined;
  }
}

/** Remember a project added by voice (kept out of config.yaml so your comments survive). */
export function saveProject(cfg: AppConfig, name: string, pc: ProjectConfig) {
  cfg.projects[name] = pc;
  mkdirSync(STATE_DIR, { recursive: true });
  const overlay = existsSync(overlayPath()) ? JSON.parse(readFileSync(overlayPath(), "utf8")) : {};
  overlay[name] = pc;
  writeFileSync(overlayPath(), JSON.stringify(overlay, null, 2));
}

export const isDefaultConfigDir = (dir: string) => resolve(dir) === resolve(homedir(), ".claude");

/** Shell command to log in to a profile, as the user would type it. */
export const loginCommand = (dir: string) => (isDefaultConfigDir(dir) ? "claude auth login" : `CLAUDE_CONFIG_DIR=${dir} claude auth login`);

/** Env for a Claude Code process running under a given account. */
export function envForProfile(cfg: AppConfig, profile: string): Record<string, string | undefined> {
  const p = cfg.profiles[profile];
  if (!p) throw new Error(`unknown profile "${profile}"`);
  const env: Record<string, string | undefined> = {
    ...process.env,
    CLAUDE_CONFIG_DIR: p.configDir,
    CLAUDE_AGENT_SDK_CLIENT_APP: "voice-orchestrator/0.1",
  };
  // The default folder must be used the way plain `claude` uses it: with CLAUDE_CONFIG_DIR unset.
  // Setting it (even to ~/.claude) makes Claude Code look under a different macOS Keychain entry -> "Not logged in".
  if (isDefaultConfigDir(p.configDir)) delete env.CLAUDE_CONFIG_DIR;
  // These would override the per-profile login and silently put both accounts on one key.
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  return env;
}

export interface AuthStatus {
  profile: string;
  configDir: string;
  loggedIn: boolean;
  detail: string;
}

/** `claude auth status --json` for each profile, run exactly as the workers will run. */
export async function checkAuth(cfg: AppConfig, profiles = Object.keys(cfg.profiles)): Promise<AuthStatus[]> {
  const bin = cfg.claudeBin ?? "claude";
  return Promise.all(
    profiles.map(async (profile) => {
      const configDir = cfg.profiles[profile].configDir;
      try {
        const { stdout } = await run(bin, ["auth", "status", "--json"], { env: envForProfile(cfg, profile) as NodeJS.ProcessEnv, timeout: 20_000 });
        const s = JSON.parse(stdout.slice(stdout.indexOf("{")));
        const who = s.email ?? s.account?.email ?? s.organizationName ?? s.orgName ?? s.authMethod ?? "";
        return { profile, configDir, loggedIn: !!s.loggedIn, detail: String(who) };
      } catch (e) {
        const err = e as { stdout?: string; message: string };
        try {
          const s = JSON.parse(String(err.stdout).slice(String(err.stdout).indexOf("{")));
          return { profile, configDir, loggedIn: !!s.loggedIn, detail: "" };
        } catch {
          return { profile, configDir, loggedIn: false, detail: err.message.split("\n")[0] };
        }
      }
    }),
  );
}

/** Loose project-name matching for speech ("web shop", "Webshop." -> webshop). */
export const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function resolveProject(cfg: AppConfig, spoken: string): string | undefined {
  const want = normName(spoken);
  if (!want) return undefined;
  const names = Object.keys(cfg.projects);
  return (
    names.find((n) => normName(n) === want) ??
    names.find((n) => normName(n).startsWith(want) || want.startsWith(normName(n))) ??
    names.find((n) => normName(n).includes(want) || want.includes(normName(n)))
  );
}

const SKIP = new Set(["node_modules", "Library", "Applications", "Music", "Movies", "Pictures", "Public", "VirtualBox VMs", "go", "dist", "build"]);

/**
 * Find project folders by spoken name under searchRoots (depth 3).
 * Matches "database admin" -> dbadmin via normalized names and initials+rest.
 */
export function findProjectDirs(cfg: AppConfig, spoken: string, maxDepth = 3): string[] {
  const want = normName(spoken);
  const words = spoken.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // "database admin" -> also try "dbadmin"-style: first letters of all-but-last + last word ... and common abbreviations
  const variants = new Set([want]);
  if (words.length > 1) {
    variants.add(words.slice(0, -1).map((w) => w[0]).join("") + words.at(-1));
    variants.add(words.map((w) => (w === "database" ? "db" : w)).join(""));
  }
  const score = (dir: string) => {
    const n = normName(basename(dir));
    if (variants.has(n)) return 3;
    if ([...variants].some((v) => n.startsWith(v) || v.startsWith(n))) return 2;
    if ([...variants].some((v) => v.length >= 4 && n.includes(v))) return 1;
    return 0;
  };
  const hits: { dir: string; s: number }[] = [];
  const seen = new Set<string>();
  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth || seen.has(dir)) return;
    seen.add(dir);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.startsWith(".") || SKIP.has(e)) continue;
      const full = join(dir, e);
      try {
        if (!statSync(full).isDirectory()) continue;
      } catch {
        continue;
      }
      const s = score(full);
      if (s) hits.push({ dir: full, s: s + (existsSync(join(full, ".git")) ? 0.5 : 0) });
      walk(full, depth + 1);
    }
  };
  for (const r of cfg.searchRoots) walk(r, 1);
  return [...new Map(hits.sort((a, b) => b.s - a.s).map((h) => [h.dir, h])).keys()].slice(0, 5);
}
