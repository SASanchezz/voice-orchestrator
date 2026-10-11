import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  legacyRegistrySchema,
  REGISTRY_FILE_VERSION,
  savedRegistrySchema,
  type LegacyRegistry,
  type ProjectState,
  type SavedRegistry,
  type SessionState,
} from "./registry-schema.js";

/** state/registry.json: projects and their sessions, so a restart keeps session ids. */
export class RegistryFile {
  constructor(private file: string) {}

  load(): SavedRegistry {
    if (!existsSync(this.file)) return { version: REGISTRY_FILE_VERSION, projects: {}, sessions: {} };
    const saved: unknown = JSON.parse(readFileSync(this.file, "utf8"));
    return isCurrentVersion(saved) ? savedRegistrySchema.parse(saved) : fromLegacy(legacyRegistrySchema.parse(saved));
  }

  save(projects: Map<string, ProjectState>, sessions: Map<string, SessionState>): void {
    const saved: SavedRegistry = {
      version: REGISTRY_FILE_VERSION,
      projects: Object.fromEntries(projects),
      sessions: Object.fromEntries(sessions),
    };
    writeFileSync(this.file, JSON.stringify(saved, null, 2));
  }
}

function isCurrentVersion(saved: unknown): boolean {
  return typeof saved === "object" && saved !== null && "version" in saved && saved.version === REGISTRY_FILE_VERSION;
}

/** Each pre-sessions project becomes a project with one session carrying its old state. */
function fromLegacy(legacy: LegacyRegistry): SavedRegistry {
  const state: SavedRegistry = { version: REGISTRY_FILE_VERSION, projects: {}, sessions: {} };
  for (const [name, old] of Object.entries(legacy)) {
    const id = randomUUID();
    state.projects[name] = { name, profile: old.profile, activeSession: id };
    state.sessions[id] = {
      id,
      project: name,
      number: 1,
      status: old.status ?? "idle",
      claudeSessionId: old.sessionId,
      lastResult: old.lastResult,
      queued: [],
      costUsd: old.costUsd ?? 0,
      history: old.history ?? [],
    };
  }
  return state;
}
