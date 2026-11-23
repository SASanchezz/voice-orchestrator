import type { ServerResponse } from "node:http";
import {
  ATTACHED_IMAGE_PATH,
  NOTICE_SCRIPT_PATH,
  QUICK_SCRIPT_PATH,
  SCRIPT_PATH,
  type PageFiles,
} from "./page-files.js";
import { NOTICE_PATH, QUICK_PATH } from "./ui-access.js";
import { MANIFEST_PATH } from "./web-manifest.js";
import type { ReadRoutes } from "./read-routes.js";

/** A set of GET routes the router asks in turn, such as the Review view's or the Messages view's. */
export interface GetRouteGroup {
  handles(url: URL): boolean;
  route(url: URL, res: ServerResponse): Promise<void>;
}

const SESSION_MESSAGES_PATH = /^\/api\/sessions\/([\w-]+)\/messages$/;

/** Sends each GET to the page files, the live events and chats, or a group such as the projects' changes. */
export class GetRoutes {
  constructor(
    private pages: PageFiles,
    private reads: ReadRoutes,
    private groups: GetRouteGroup[],
  ) {}

  prepare(): Promise<void> {
    return this.pages.prepare();
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    const group = this.groups.find((candidate) => candidate.handles(url));
    if (group) return await group.route(url, res);
    this.pageOrChat(url, res);
  }

  private pageOrChat(url: URL, res: ServerResponse): void {
    const exact = this.exactRoutes[url.pathname];
    if (exact) return exact(url, res);
    const sessionMessages = url.pathname.match(SESSION_MESSAGES_PATH);
    if (sessionMessages) return this.reads.sessionMessages(url, sessionMessages[1], res);
    this.pages.staticFile(url.pathname, res);
  }

  /** The pages, their scripts, the live events, attached images and the manifest, each at a path of its own. */
  private exactRoutes: Record<string, ExactRoute | undefined> = {
    "/": (url, res) => this.pages.page(url, res),
    [NOTICE_PATH]: (url, res) => this.pages.noticePage(url, res),
    [QUICK_PATH]: (url, res) => this.pages.quickPage(url, res),
    "/api/events": (url, res) => this.reads.events(url, res),
    [ATTACHED_IMAGE_PATH]: (url, res) => this.pages.attachedImage(url, res),
    [SCRIPT_PATH]: (_url, res) => this.pages.serveScript(res),
    [NOTICE_SCRIPT_PATH]: (_url, res) => this.pages.serveNoticeScript(res),
    [QUICK_SCRIPT_PATH]: (_url, res) => this.pages.serveQuickScript(res),
    [MANIFEST_PATH]: (url, res) => this.pages.manifest(url, res),
  };
}

type ExactRoute = (url: URL, res: ServerResponse) => void;
