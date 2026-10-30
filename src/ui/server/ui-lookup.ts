import type { AppConfig } from "../../config/app-config.js";
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
    private projectConfigs: AppConfig["projects"],
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
    return this.projectConfigs[name]?.path ?? "";
  }

  session(id: string): SessionState {
    return this.sessions.session(id);
  }

  labelOf(id: string): string {
    return this.sessions.labelOf(id);
  }

  projectViews(): ProjectView[] {
    return this.projects.all().map((p) => {
      const folder = this.projectConfigs[p.name]?.path ?? "";
      return { ...p, folder, folderFromHome: tildeHome(folder), sessions: this.sessions.sessionsOf(p.name) };
    });
  }
}
