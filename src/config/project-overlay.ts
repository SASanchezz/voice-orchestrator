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
  mkdirSync(STATE_DIR, { recursive: true });
  const overlay = readProjectOverlay();
  overlay[name] = project;
  writeFileSync(overlayPath(), JSON.stringify(overlay, null, 2));
}
