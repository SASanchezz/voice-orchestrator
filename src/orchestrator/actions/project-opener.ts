import { existsSync } from "node:fs";
import type { AppConfig, ProjectConfig } from "../../config/app-config.js";
import { expandHome } from "../../config/paths.js";
import { normName } from "../../config/project-names.js";
import { saveProject } from "../../config/project-overlay.js";
import { findProjectDirs } from "../../config/project-search.js";
import type { Registry } from "../../registry/registry.js";
import { needProject } from "../tools/tool-kit.js";
import type { AccountSwitch } from "./account-switch.js";

/** Finds a folder by spoken name (or exact path) and registers it as a project on an account. */
export class ProjectOpener {
  constructor(
    private cfg: AppConfig,
    private registry: Registry,
    private accounts: AccountSwitch,
  ) {}

  open(name: string, profile?: string): string {
    const account = profile ?? this.cfg.orchestrator.profile;
    if (!this.cfg.profiles[account]) throw new Error(`Unknown account ${account}`);
    const dirs = this.candidates(name);
    if (!dirs.length) return `No folder matching "${name}" under ${this.cfg.searchRoots.join(", ")}.`;
    if (isAmbiguous(dirs, name)) return `Several matches, ask the user which: ${dirs.join(" | ")}`;
    const dir = findExact(dirs, name) ?? dirs[0];
    const existing = Object.entries(this.cfg.projects).find(([, p]) => p.path === dir);
    if (existing) return this.alreadyOpen(existing, dir, profile);
    const key = lastSegment(dir);
    saveProject(this.cfg, key, { path: dir, profile: account });
    this.registry.ensure(key, account);
    return `Opened ${key} at ${dir} on the ${account} account.`;
  }

  private candidates(name: string): string[] {
    const asPath = expandHome(name);
    return name.includes("/") && existsSync(asPath) ? [asPath] : findProjectDirs(this.cfg, name);
  }

  /** Asking for another account moves the project there; a refused move (e.g. it's busy) is left unsaid, as before. */
  private alreadyOpen([key, project]: [string, ProjectConfig], dir: string, profile: string | undefined): string {
    if (profile && project.profile !== profile) this.trySwitch(key, profile);
    return `${key} is already a project (${this.accounts.accountOf(key)} account), at ${dir}.`;
  }

  private trySwitch(key: string, profile: string): void {
    try {
      this.accounts.switch(needProject(this.cfg, key), profile);
    } catch {
      // the switch is reported by the account it ends up on
    }
  }
}

function isAmbiguous(dirs: string[], spoken: string): boolean {
  const [first, second] = dirs.map((dir) => normName(lastSegment(dir)));
  return dirs.length > 1 && first !== second && first !== normName(spoken) && !findExact(dirs, spoken);
}

function findExact(dirs: string[], spoken: string): string | undefined {
  return dirs.find((dir) => normName(lastSegment(dir)) === normName(spoken));
}

function lastSegment(dir: string): string {
  return dir.split("/").at(-1) ?? "";
}
