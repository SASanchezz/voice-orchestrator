import type { BackgroundJobs } from "../../workers/background-jobs.js";
import type { ProjectView, SessionView } from "../protocol.js";
import type { UiLookup } from "./ui-lookup.js";

/** The projects as the page shows them, each session with the background jobs its worker waits on. */
export class ProjectsWithJobs {
  constructor(
    private lookup: Pick<UiLookup, "projectViews">,
    private jobs: Pick<BackgroundJobs, "jobsOf">,
  ) {}

  projectViews(): ProjectView[] {
    return this.lookup.projectViews().map((project) => ({ ...project, sessions: this.withJobs(project.sessions) }));
  }

  private withJobs(sessions: SessionView[]): SessionView[] {
    return sessions.map((session) => ({ ...session, backgroundJobs: this.jobs.jobsOf(session.id) }));
  }
}
