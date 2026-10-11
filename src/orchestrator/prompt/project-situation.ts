import type { PermissionViews } from "../../permissions/permission-views.js";
import type { StatusReport } from "../../registry/status-report.js";
import type { TaskHistory } from "../../registry/task-history.js";

/** The parts of the system prompt about the work right now: project status, recent tasks, waiting permission requests. */
export class ProjectSituation {
  constructor(
    private status: StatusReport,
    private history: TaskHistory,
    private permissions: PermissionViews,
  ) {}

  parts(): string[] {
    const recentWork = this.history.recentWork();
    const waiting = this.permissions.list();
    return [
      `Current project status:\n${this.status.snapshot()}`,
      recentWork && `Recent tasks per project (oldest first):\n${recentWork}`,
      waiting.length ? `Permission requests still waiting: ${JSON.stringify(waiting)}` : "",
    ].filter(Boolean);
  }
}
