import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { projectSchema, type AppConfig, type ProjectConfig } from "./app-config.js";
import { STATE_DIR } from "./paths.js";

// Projects added by voice live in state/projects.json, kept out of config.yaml so your comments survive.

const overlaySchema = z.record(z.string(), projectSchema);

const overlayPath = (): string => resolve(STATE_DIR, "projects.json");

export function readProjectOverlay(): Record<string, ProjectConfig> {
  if (!existsSync(overlayPath())) return {};
  return overlaySchema.parse(JSON.parse(readFileSync(overlayPath(), "utf8")));
}

/** Remember a project added by voice, in the running config and for the next start. */
export function saveProject(cfg: AppConfig, name: string, project: ProjectConfig): void {
  cfg.projects[name] = project;
  const overlay = readProjectOverlay();
  overlay[name] = project;
  writeOverlay(overlay);
}

/** Forget a project added by voice, for the next start. */
export function forgetSavedProject(name: string): void {
  const overlay = readProjectOverlay();
  if (!(name in overlay)) return;
  writeOverlay(Object.fromEntries(Object.entries(overlay).filter(([saved]) => saved !== name)));
}

function writeOverlay(overlay: Record<string, ProjectConfig>): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(overlayPath(), JSON.stringify(overlay, null, 2));
}
