// What Claude Code itself picks for a worker when neither its session nor config.yaml says: the `model` and
// `effortLevel` in the project's own Claude settings, else in its account's, in the order Claude Code reads them.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { WORKER_EFFORT_IDS, type WorkerEffort } from "../workers/worker-efforts.js";

/** A setting Claude Code wouldn't take counts as unset, without losing the other one. */
const claudeSettingsSchema = z.object({
  model: z.string().optional().catch(undefined),
  effortLevel: z.enum(WORKER_EFFORT_IDS).optional().catch(undefined),
});
type ClaudeSettings = z.infer<typeof claudeSettingsSchema>;

/** Unset when no settings file names one: Claude Code's built-in default. */
export function claudeDefaultModel(projectFolder: string, configDir: string): string | undefined {
  return settingsIn(projectFolder, configDir).find((settings) => settings.model !== undefined)?.model;
}

/** Unset when no settings file names one: Claude Code's built-in default for the model. */
export function claudeDefaultEffort(projectFolder: string, configDir: string): WorkerEffort | undefined {
  return settingsIn(projectFolder, configDir).find((settings) => settings.effortLevel !== undefined)?.effortLevel;
}

function settingsIn(projectFolder: string, configDir: string): ClaudeSettings[] {
  const files = [
    join(projectFolder, ".claude", "settings.local.json"),
    join(projectFolder, ".claude", "settings.json"),
    join(configDir, "settings.json"),
  ];
  return files.map(settingsOf);
}

function settingsOf(file: string): ClaudeSettings {
  if (!existsSync(file)) return {};
  return claudeSettingsSchema.safeParse(parsedJson(file)).data ?? {};
}

/** A settings file Claude Code can't read either counts as naming nothing. */
function parsedJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}
