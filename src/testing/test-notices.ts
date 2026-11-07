import type { BrowserPage } from "../ui/server/page-opener.js";
import type { NoticePanelDevice } from "../ui/notices/task-notices.js";

/** A fake notice panel: tests read the links it was shown with and whether it is up. */
export class TestNoticePanel implements NoticePanelDevice {
  shownLinks: string[] = [];
  isShowing = false;

  show(link: string): void {
    this.shownLinks.push(link);
    this.isShowing = true;
  }

  hide(): void {
    this.isShowing = false;
  }
}

/** A fake browser that records the links it was asked to bring to the front. */
export class TestBrowserPage implements BrowserPage {
  focusedLinks: string[] = [];

  async focus(link: string): Promise<void> {
    this.focusedLinks.push(link);
  }
}
