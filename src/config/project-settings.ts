import { existsSync, readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import type { AppConfig } from "./app-config.js";
import { forgetSavedProject } from "./project-overlay.js";

/**
 * Where projects are configured: the running config, config.yaml (edited in place, so your comments survive)
 * and state/projects.json for projects added by voice.
 */
export class ProjectSettings {
  constructor(
    private cfg: AppConfig,
    private configFile: string,
  ) {}

  /** The project is gone from every place it was configured, now and after a restart. */
  forget(name: string): void {
    delete this.cfg.projects[name]; // in place: others hold this same object
    forgetSavedProject(name);
    removeFromConfigFile(this.configFile, name);
  }
}

function removeFromConfigFile(configFile: string, name: string): void {
  if (!existsSync(configFile)) return;
  const document = YAML.parseDocument(readFileSync(configFile, "utf8"));
  if (!document.hasIn(["projects", name])) return;
  document.deleteIn(["projects", name]);
  writeFileSync(configFile, document.toString());
}
