// The model Claude Code itself picks for a worker when neither its session nor config.yaml names one: the `model` in
// the project's own Claude settings, else in its account's, in the order Claude Code reads them.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const claudeSettingsSchema = z.object({ model: z.string().optional() });

/** Unset when no settings file names one: Claude Code's built-in default. */
export function claudeDefaultModel(projectFolder: string, configDir: string): string | undefined {
  const files = [
    join(projectFolder, ".claude", "settings.local.json"),
    join(projectFolder, ".claude", "settings.json"),
    join(configDir, "settings.json"),
  ];
  return files.map(modelIn).find((model) => model !== undefined);
}

function modelIn(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  return claudeSettingsSchema.safeParse(parsedJson(file)).data?.model;
}

/** A settings file Claude Code can't read either counts as naming no model. */
function parsedJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}
