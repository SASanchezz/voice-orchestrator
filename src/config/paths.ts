import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const CONFIG_PATH = resolve(APP_DIR, "config/config.yaml");
export const DESTRUCTIVE_PATH = resolve(APP_DIR, "config/destructive.yaml");
export const NOTES_PATH = resolve(APP_DIR, "config/notes.md");
/** The specialized agent every assistant chat runs as; the app doesn't start without it. */
export const ASSISTANT_AGENT_PATH = resolve(APP_DIR, "agents/voice-assistant.md");
export let STATE_DIR = process.env.VO_STATE_DIR ?? resolve(APP_DIR, "state");

/** Points everything kept in state/ at another folder (tests use a temporary one). */
export function setStateDir(dir: string): void {
  STATE_DIR = dir;
}

export function expandHome(path: string): string {
  return path.startsWith("~") ? homedir() + path.slice(1) : path;
}

/** The reverse of expandHome: a folder under your home folder written as ~/… */
export function tildeHome(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}
