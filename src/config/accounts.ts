import { homedir } from "node:os";
import { resolve } from "node:path";
import type { AppConfig } from "./app-config.js";

type ProcessEnv = Record<string, string | undefined>;

export function isDefaultConfigDir(dir: string): boolean {
  return resolve(dir) === resolve(homedir(), ".claude");
}

/** Shell command to log in to a profile, as the user would type it. */
export function loginCommand(dir: string): string {
  return isDefaultConfigDir(dir) ? "claude auth login" : `CLAUDE_CONFIG_DIR=${dir} claude auth login`;
}

/** Env for a Claude Code process running under a given account. */
export function envForProfile(cfg: AppConfig, profile: string): ProcessEnv {
  const account = cfg.profiles[profile];
  if (!account) throw new Error(`unknown profile "${profile}"`);
  const env: ProcessEnv = {
    ...process.env,
    CLAUDE_CONFIG_DIR: account.configDir,
    CLAUDE_AGENT_SDK_CLIENT_APP: "voice-orchestrator/0.1",
  };
  // The default folder must be used the way plain `claude` uses it: with CLAUDE_CONFIG_DIR unset.
  // Setting it (even to ~/.claude) makes Claude Code look under a different macOS Keychain entry -> "Not logged in".
  if (isDefaultConfigDir(account.configDir)) delete env.CLAUDE_CONFIG_DIR;
  // These would override the per-profile login and silently put both accounts on one key.
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  return env;
}
