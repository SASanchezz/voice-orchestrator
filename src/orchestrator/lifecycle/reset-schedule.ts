import type { AppConfig } from "../../config/app-config.js";
import type { WaitingRequests } from "../../permissions/waiting-requests.js";
import type { OperatorSession } from "../model/operator-session.js";

const MINUTE_MS = 60_000;

/** The hourly reset (resetMinutes): due once the session is that old, but never while a permission request waits. */
export class ResetSchedule {
  constructor(
    private settings: AppConfig["orchestrator"],
    private session: OperatorSession,
    private waiting: WaitingRequests,
  ) {}

  isDue(): boolean {
    const old = this.session.ageMs() > this.settings.resetMinutes * MINUTE_MS;
    return old && !this.waiting.all().length;
  }
}
