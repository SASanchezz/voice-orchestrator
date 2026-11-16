import type { AppConfig } from "./app-config.js";

/** Where a project's Chrome profile can be set: on the project, or on its account. */
export type ChromeProfileSettings = Pick<AppConfig, "projects" | "profiles">;

/** The Chrome profile a project's links open in: its own, else its account's; none means beside the web UI. */
export function chromeProfileOf(settings: ChromeProfileSettings, project: string): string | undefined {
  const projectSettings = settings.projects[project];
  if (!projectSettings) return undefined;
  return projectSettings.chromeProfile ?? settings.profiles[projectSettings.profile]?.chromeProfile;
}
