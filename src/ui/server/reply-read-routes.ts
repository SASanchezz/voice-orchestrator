import type { ServerResponse } from "node:http";
import type { DraftingSwitch } from "../../messages/replies/drafting-switch.js";
import type { DraftViews } from "../../messages/replies/draft-views.js";
import type { ReplyCheckup } from "../../messages/replies/reply-checkup.js";
import { HTTP_STATUS } from "./http-error.js";
import type { UiAccess } from "./ui-access.js";
import type { DraftingView } from "../reply-views.js";

const DRAFTS_PATH = "/api/replies";
const CHECKUP_PATH = "/api/replies/checkup";
const DRAFTING_PATH = "/api/replies/drafting";
const CONTEXT_PATH = /^\/api\/replies\/([\w-]+)\/context$/;

/** What the Messages view reads about drafted replies. */
export interface ReplyReads {
  views: DraftViews;
  checkup: ReplyCheckup;
  drafting: DraftingSwitch;
}

/** The drafts waiting for you, the conversation one of them answers, the setup checkup and whether drafting is on. */
export class ReplyReadRoutes {
  constructor(
    private access: UiAccess,
    private reads: ReplyReads,
  ) {}

  handles(url: URL): boolean {
    return [DRAFTS_PATH, CHECKUP_PATH, DRAFTING_PATH].includes(url.pathname) || CONTEXT_PATH.test(url.pathname);
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const body = await this.bodyFor(url.pathname);
    res.writeHead(HTTP_STATUS.ok, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  }

  private async bodyFor(path: string): Promise<unknown> {
    if (path === CHECKUP_PATH) return this.reads.checkup.run();
    if (path === DRAFTING_PATH) return { on: this.reads.drafting.isOn() } satisfies DraftingView;
    const context = CONTEXT_PATH.exec(path);
    return context ? this.reads.views.context(context[1]) : this.reads.views.waiting();
  }
}
