import type { ServerResponse } from "node:http";
import type { RecentPlanUsage } from "../../limits/recent-plan-usage.js";
import { sendJson } from "./changes-routes.js";
import type { UiAccess } from "./ui-access.js";

export const PLAN_USAGE_PATH = "/api/plan-usage";

/** What the top bar's usage readout reads. */
export class PlanUsageRoute {
  constructor(
    private access: UiAccess,
    private usage: RecentPlanUsage,
  ) {}

  async all(url: URL, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    sendJson(res, await this.usage.all());
  }
}
