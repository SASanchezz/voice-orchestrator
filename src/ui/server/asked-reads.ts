import type { ServerResponse } from "node:http";
import { MESSENGER_STATUS_PATH, type MessengerStatusRoute } from "./messenger-status-route.js";
import { PLAN_USAGE_PATH, type PlanUsageRoute } from "./plan-usage-route.js";
import type { WakeRecordingRoutes } from "./wake-recording-routes.js";

/**
 * The reads a dialog or readout asks for when it opens: plan usage, the messengers' logins, and your wake word
 * training recordings.
 */
export class AskedReads {
  constructor(
    private usage: PlanUsageRoute,
    private messengers: MessengerStatusRoute,
    private wakeRecordings: WakeRecordingRoutes,
  ) {}

  handles(url: URL): boolean {
    const isAsked = url.pathname === PLAN_USAGE_PATH || url.pathname === MESSENGER_STATUS_PATH;
    return isAsked || this.wakeRecordings.handles(url);
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    if (this.wakeRecordings.handles(url)) return this.wakeRecordings.route(url, res);
    if (url.pathname === PLAN_USAGE_PATH) return await this.usage.all(url, res);
    await this.messengers.all(url, res);
  }
}
