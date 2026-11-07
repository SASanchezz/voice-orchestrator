import type { NoticePanel, NoticePanelDevice } from "./task-notices.js";

/** The native notice panel, always brought up on the web UI's notice page. */
export class LinkedNoticePanel implements NoticePanel {
  constructor(
    private device: NoticePanelDevice,
    private pageLink: () => string,
  ) {}

  show(): void {
    this.device.show(this.pageLink());
  }

  hide(): void {
    this.device.hide();
  }
}
