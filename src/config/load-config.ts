import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { configFileSchema, type AppConfig } from "./app-config.js";
import { CONFIG_PATH, expandHome } from "./paths.js";
import { readProjectOverlay } from "./project-overlay.js";

export function loadConfig(path = CONFIG_PATH): AppConfig {
  const parsed = configFileSchema.parse(YAML.parse(readFileSync(path, "utf8")));
  const cfg: AppConfig = { ...parsed, claudeBin: resolveClaudeBin(parsed.claudeBin) };
  Object.assign(cfg.projects, readProjectOverlay()); // projects added by voice
  checkProfiles(cfg);
  return cfg;
}

function resolveClaudeBin(setting: string | undefined): string | undefined {
  if (setting && setting !== "auto") return expandHome(setting);
  try {
    return claudeOnLoginShellPath();
  } catch {
    return undefined;
  }
}

/** A login shell, so Homebrew / ~/.local/bin / nvm paths are found even when started from an IDE. */
function claudeOnLoginShellPath(): string | undefined {
  const shell = process.env.SHELL || "/bin/zsh";
  const found = execFileSync(shell, ["-lc", "command -v claude"], { encoding: "utf8" });
  return found.trim().split("\n").pop() || undefined;
}

function checkProfiles(cfg: AppConfig): void {
  if (!cfg.profiles[cfg.orchestrator.profile])
    throw new Error(`orchestrator.profile "${cfg.orchestrator.profile}" is not in profiles`);
  for (const [name, project] of Object.entries(cfg.projects))
    if (!cfg.profiles[project.profile]) throw new Error(`project ${name}: unknown profile "${project.profile}"`);
}
