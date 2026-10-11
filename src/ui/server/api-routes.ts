import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import { readJson } from "./request-body.js";
import type { RouteTable } from "./route-table.js";
import type { StatePublisher } from "./state-publisher.js";
import type { UiAccess } from "./ui-access.js";

/** The page's actions over POST; the token comes in a header. Every page sees the outcome at once. */
export class ApiRoutes {
  constructor(
    private access: UiAccess,
    private table: RouteTable,
    private publisher: StatePublisher,
  ) {}

  async post(url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.access.requireToken(req.headers["x-token"], "Bad token");
    const found = this.table.find(url.pathname);
    if (!found) throw new HttpError(HTTP_STATUS.notFound, "Not found");
    const message = await found.route(await readJson(req), found.match);
    this.publisher.pushIfChanged();
    res.writeHead(HTTP_STATUS.ok, { "content-type": "application/json" });
    res.end(JSON.stringify({ message }));
  }
}
