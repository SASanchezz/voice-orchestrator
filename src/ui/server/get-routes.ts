import type { ServerResponse } from "node:http";
import type { ChangesRoutes } from "./changes-routes.js";
import { ATTACHED_IMAGE_PATH, SCRIPT_PATH, type PageFiles } from "./page-files.js";
import type { ReadRoutes } from "./read-routes.js";

const SESSION_MESSAGES_PATH = /^\/api\/sessions\/([\w-]+)\/messages$/;
const ALL_CHANGES_PATH = "/api/changes";
const FILE_DIFF_PATH = /^\/api\/projects\/([^/]+)\/changes\/diff$/;

/** Sends each GET to the page files, the live events and chats, or the projects' changes. */
export class GetRoutes {
  constructor(
    private pages: PageFiles,
    private reads: ReadRoutes,
    private changes: ChangesRoutes,
  ) {}

  prepare(): Promise<void> {
    return this.pages.prepare();
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    if (url.pathname === ALL_CHANGES_PATH) return await this.changes.all(url, res);
    const fileDiff = url.pathname.match(FILE_DIFF_PATH);
    if (fileDiff) return await this.changes.fileDiff(url, decodeURIComponent(fileDiff[1]), res);
    this.pageOrChat(url, res);
  }

  private pageOrChat(url: URL, res: ServerResponse): void {
    if (url.pathname === "/") return this.pages.page(url, res);
    if (url.pathname === "/api/events") return this.reads.events(url, res);
    const sessionMessages = url.pathname.match(SESSION_MESSAGES_PATH);
    if (sessionMessages) return this.reads.sessionMessages(url, sessionMessages[1], res);
    if (url.pathname === ATTACHED_IMAGE_PATH) return this.pages.attachedImage(url, res);
    if (url.pathname === SCRIPT_PATH) return this.pages.serveScript(res);
    this.pages.staticFile(url.pathname, res);
  }
}
