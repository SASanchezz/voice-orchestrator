import type { AppConfig } from "./app-config.js";

/** Projects whose profile names no account in config.yaml's profiles. */
export function projectsOnUnknownAccounts(cfg: AppConfig): string[] {
  return Object.keys(cfg.projects).filter((name) => !cfg.profiles[cfg.projects[name].profile]);
}

/** A typo in a project's account shouldn't stop the app: the project runs on the orchestrator's account, and says so. */
export function moveToOrchestratorAccount(cfg: AppConfig, name: string): void {
  const project = cfg.projects[name];
  const fallback = cfg.orchestrator.profile;
  const known = Object.keys(cfg.profiles).join(", ");
  console.warn(
    `[config] project ${name}: no account "${project.profile}" in profiles (${known}), so it runs on ${fallback}. ` +
      `Fix its profile in config/config.yaml or state/projects.json; a Chrome profile goes in chromeProfile.`,
  );
  cfg.projects[name] = { ...project, profile: fallback };
}
