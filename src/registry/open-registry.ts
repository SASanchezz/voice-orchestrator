import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import type { AppEvents } from "../events/app-events.js";
import { Projects } from "./projects.js";
import { RegistryFile } from "./registry-file.js";
import { Registry } from "./registry.js";
import { RestoredRegistry } from "./restored-registry.js";
import { Sessions } from "./sessions.js";

/** The source of truth for projects and sessions, in three parts that save to one file. */
export interface RegistryParts {
  projects: Projects;
  sessions: Sessions;
  registry: Registry;
}

/** Loads state/registry.json for the projects in config (name -> account). Nothing is written until something changes. */
export function openRegistry(projectProfiles: Record<string, string>, events: AppEvents): RegistryParts {
  mkdirSync(STATE_DIR, { recursive: true });
  const file = new RegistryFile(resolve(STATE_DIR, "registry.json"));
  const restored = new RestoredRegistry(file.load());
  for (const [name, profile] of Object.entries(projectProfiles)) restored.restore(name, profile);
  const save = (): void => file.save(restored.projects, restored.sessions);
  const projects = new Projects(restored.projects, save);
  const sessions = new Sessions(restored.sessions, save);
  return { projects, sessions, registry: new Registry(projects, sessions, events) };
}
