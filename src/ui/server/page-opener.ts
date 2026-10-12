import { pageHash, type PageTarget } from "../page-target.js";
import type { LiveClients } from "./live-clients.js";

/** The web UI's tab in your browser. */
export interface BrowserPage {
  /** Brings the tab showing this link's page to the front, or opens the link. */
  focus(link: string): Promise<void>;
}

/**
 * Takes the web UI to a task's reply or session: open pages switch there and the browser brings the tab
 * to the front; with no tab open, the link opens one that goes there by its #hash.
 */
export class PageOpener {
  constructor(
    private clients: Pick<LiveClients, "broadcast">,
    private browser: BrowserPage,
    private link: () => string,
  ) {}

  async open(target: PageTarget): Promise<void> {
    this.clients.broadcast("navigate", target);
    await this.browser.focus(`${this.link()}${pageHash(target)}`);
  }
}
