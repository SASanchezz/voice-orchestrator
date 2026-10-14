import type { SessionLifecycle } from "../../orchestrator/lifecycle/session-lifecycle.js";

/** The whole app, from the page. */
export class AppActions {
  constructor(private lifecycle: SessionLifecycle) {}

  /** Restarts as the assistant's restart_orchestrator does, once this reply is sent: restarting stops this server. */
  restartApp(): string {
    setImmediate(() => this.lifecycle.restart());
    return "Restarting.";
  }
}
