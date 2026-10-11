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
  ) {}

  requireProject(name: string): void {
    if (!this.projects.has(name)) throw new HttpError(HTTP_STATUS.notFound, `No project ${name}`);
  }

  requireSession(id: string): void {
    if (!this.sessions.hasSession(id)) throw new HttpError(HTTP_STATUS.notFound, `No session ${id}`);
  }

  session(id: string): SessionState {
    return this.sessions.session(id);
  }

  labelOf(id: string): string {
    return this.sessions.labelOf(id);
  }

  projectViews(): ProjectView[] {
    return this.projects.all().map((p) => ({ ...p, sessions: this.sessions.sessionsOf(p.name) }));
  }
}
