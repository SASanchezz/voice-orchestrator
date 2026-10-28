import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "../../config/app-config.js";
import { DEFAULT_BUDGET } from "../../config/budget-config.js";
import { DEFAULT_CAMERA } from "../../config/camera-config.js";
import { DEFAULT_EDITOR_SETTINGS } from "../../config/editor-config.js";
import { DEFAULT_SENSORS } from "../../config/sensor-config.js";
import { DESTRUCTIVE_PATH, setStateDir } from "../../config/paths.js";

/** A temporary home with real git repos, two account folders, and the app's state, rules and notes. */
export const root = mkdtempSync(join(tmpdir(), "vo-e2e-"));
export const home = join(root, "home");
const personalDir = join(root, ".claude-personal");
const workDir = join(root, ".claude-work");
export const dbadmin = join(home, "code", "dbadmin");
export const acmeWeb = join(home, "acme", "acme-web");
export const rulesFile = join(root, "destructive.yaml");
export const notesFile = join(root, "notes.md");
export const configFile = join(root, "config.yaml");
export const scratchpad = join(home, "code", "scratchpad");

function gitInit(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "README.md"), "# " + dir.split("/").pop() + "\n");
  execSync("git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm init", { cwd: dir });
}

gitInit(dbadmin);
gitInit(acmeWeb);
gitInit(join(home, "acme", "acme-api")); // a decoy, to check "acme-web" picks the right one
mkdirSync(personalDir);
mkdirSync(workDir);
setStateDir(join(root, "state"));
gitInit(scratchpad); // opened and then removed again
writeFileSync(
  configFile,
  "projects:\n  scratchpad: # a throwaway\n    path: ~/code/scratchpad\n    profile: personal\n  keepme:\n    path: ~/code/keepme\n    profile: personal\n",
);
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
writeFileSync(notesFile, "# Assistant notes\n\n## Aliases\n\n- dbadmin is also called database admin.\n");

export const cfg: AppConfig = {
  orchestrator: { profile: "personal", resetMinutes: 60, rules: ["Call the user captain."], answerWindowSeconds: 0 },
  profiles: { personal: { configDir: personalDir }, work: { configDir: workDir } },
  projects: {},
  searchRoots: [home],
  claudeBin: "/fake/claude",
  voice: {
    hotkey: "x",
    recordBin: "x",
    whisperBin: "x",
    whisperModel: "x",
    language: "en",
    speak: "all",
  },
  ui: { port: 0, open: false },
  permissions: { mode: "ask", reminderMinutes: 60, alwaysDestination: "localSettings" },
  budget: DEFAULT_BUDGET,
  sensors: DEFAULT_SENSORS,
  camera: DEFAULT_CAMERA,
  editor: DEFAULT_EDITOR_SETTINGS,
};

/** Which account a Claude Code process ran under, from its CLAUDE_CONFIG_DIR. */
export function accountOf(configDir: string | undefined): string {
  if (configDir === personalDir) return "personal";
  return configDir === workDir ? "work" : `?${configDir}`;
}

export const staged = (dir: string): string =>
  execSync("git diff --cached --name-only", { cwd: dir, encoding: "utf8" }).trim();
export const commitCount = (dir: string): number =>
  execSync("git log --oneline", { cwd: dir, encoding: "utf8" }).trim().split("\n").length;
