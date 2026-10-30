import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiRoutes } from "./api-routes.js";
import type { GetRoutes } from "./get-routes.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import { PLAN_USAGE_PATH, type PlanUsageRoute } from "./plan-usage-route.js";

/** Sends each request to what the page reads, or to the actions. */
export class UiRouter {
  constructor(
    private gets: GetRoutes,
    private api: ApiRoutes,
    private usage: PlanUsageRoute,
  ) {}

  prepare(): Promise<void> {
    return this.gets.prepare();
  }

  async route(url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === "GET") return await this.read(url, res);
    if (req.method === "POST") return await this.api.post(url, req, res);
    throw new HttpError(HTTP_STATUS.methodNotAllowed, "Method not allowed");
  }

  private async read(url: URL, res: ServerResponse): Promise<void> {
    if (url.pathname === PLAN_USAGE_PATH) return await this.usage.all(url, res);
    await this.gets.route(url, res);
  }
}
