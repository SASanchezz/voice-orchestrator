import { chromeProfileOf, type ChromeProfileSettings } from "../../config/chrome-profile.js";
import { claudeDefaultModel } from "../../config/claude-default-model.js";
import { tildeHome } from "../../config/paths.js";
import type { Projects } from "../../registry/projects.js";
import type { SessionState } from "../../registry/registry-schema.js";
import type { Sessions } from "../../registry/sessions.js";
import type { ProjectView } from "../protocol.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";

/** The projects and sessions a page refers to; unknown ones are a 404. */
export class UiLookup {
  constructor(
    private projects: Projects,
    private sessions: Sessions,
    private settings: ChromeProfileSettings,
  ) {}

  requireProject(name: string): void {
    if (!this.projects.has(name)) throw new HttpError(HTTP_STATUS.notFound, `No project ${name}`);
  }

  requireSession(id: string): void {
    if (!this.sessions.hasSession(id)) throw new HttpError(HTTP_STATUS.notFound, `No session ${id}`);
  }

  /** The folder of a known project. */
  folderOf(name: string): string {
    this.requireProject(name);
    return this.settings.projects[name]?.path ?? "";
  }

  /** The Chrome profile a known project's links open in; one without is a 400. */
  chromeProfileOf(name: string): string {
    this.requireProject(name);
    const chromeProfile = chromeProfileOf(this.settings, name);
    if (!chromeProfile) throw new HttpError(HTTP_STATUS.badRequest, `${name} has no Chrome profile set`);
    return chromeProfile;
  }

  session(id: string): SessionState {
    return this.sessions.session(id);
  }

  sessionsOf(project: string): SessionState[] {
    return this.sessions.sessionsOf(project);
  }

  labelOf(id: string): string {
    return this.sessions.labelOf(id);
  }

  projectViews(): ProjectView[] {
    return this.projects.all().map((p) => {
      const config = this.settings.projects[p.name];
      const folder = config?.path ?? "";
      const sessions = this.sessions.sessionsOf(p.name);
      const chromeProfile = chromeProfileOf(this.settings, p.name);
      const claudeModel = this.claudeModelOf(folder, p.profile);
      const model = config?.model;
      return { ...p, folder, folderFromHome: tildeHome(folder), model, claudeModel, chromeProfile, sessions };
    });
  }

  private claudeModelOf(folder: string, profile: string): string | undefined {
    const configDir = this.settings.profiles[profile]?.configDir;
    return configDir ? claudeDefaultModel(folder, configDir) : undefined;
  }
}
