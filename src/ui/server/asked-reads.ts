import type { ServerResponse } from "node:http";
import { MESSENGER_STATUS_PATH, type MessengerStatusRoute } from "./messenger-status-route.js";
import { PLAN_USAGE_PATH, type PlanUsageRoute } from "./plan-usage-route.js";

/** The reads the server only learns the answer to by asking: plan usage and the messengers' logins. */
export class AskedReads {
  constructor(
    private usage: PlanUsageRoute,
    private messengers: MessengerStatusRoute,
  ) {}

  handles(url: URL): boolean {
    return url.pathname === PLAN_USAGE_PATH || url.pathname === MESSENGER_STATUS_PATH;
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    if (url.pathname === PLAN_USAGE_PATH) return await this.usage.all(url, res);
    await this.messengers.all(url, res);
  }
}
