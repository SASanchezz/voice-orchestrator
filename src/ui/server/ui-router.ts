import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiRoutes } from "./api-routes.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import { ATTACHED_IMAGE_PATH, SCRIPT_PATH, type PageFiles } from "./page-files.js";
import type { ReadRoutes } from "./read-routes.js";

const SESSION_MESSAGES_PATH = /^\/api\/sessions\/([\w-]+)\/messages$/;

/** Sends each request to the page files, the read routes, or the actions. */
export class UiRouter {
  constructor(
    private pages: PageFiles,
    private reads: ReadRoutes,
    private api: ApiRoutes,
  ) {}

  prepare(): Promise<void> {
    return this.pages.prepare();
  }

  async route(url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === "GET") return this.get(url, res);
    if (req.method === "POST") return await this.api.post(url, req, res);
    throw new HttpError(HTTP_STATUS.methodNotAllowed, "Method not allowed");
  }

  private get(url: URL, res: ServerResponse): void {
    if (url.pathname === "/") return this.pages.page(url, res);
    if (url.pathname === "/api/events") return this.reads.events(url, res);
    const sessionMessages = url.pathname.match(SESSION_MESSAGES_PATH);
    if (sessionMessages) return this.reads.sessionMessages(url, sessionMessages[1], res);
    if (url.pathname === ATTACHED_IMAGE_PATH) return this.pages.attachedImage(url, res);
    if (url.pathname === SCRIPT_PATH) return this.pages.serveScript(res);
    this.pages.staticFile(url.pathname, res);
  }
}
