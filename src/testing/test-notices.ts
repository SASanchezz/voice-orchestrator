import type { BrowserPage } from "../ui/server/page-opener.js";
import type { Notice, NoticeDevice } from "../ui/task-notices.js";

/** A fake notice as a test sees it: what it says, and a way to click one of its buttons by answer. */
export interface TestNotice extends Notice {
  click(answer: string): void;
}

/** Fake native notices: tests read what was shown and click its buttons. */
export class TestNotices implements NoticeDevice {
  shown: TestNotice[] = [];

  notify(notice: Notice, chosen: (answer: string) => void): void {
    this.shown.push({ ...notice, click: chosen });
  }
}

/** A fake browser that records the links it was asked to bring to the front. */
export class TestBrowserPage implements BrowserPage {
  focusedLinks: string[] = [];

  async focus(link: string): Promise<void> {
    this.focusedLinks.push(link);
  }
}
