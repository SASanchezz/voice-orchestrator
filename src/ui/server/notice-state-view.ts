import type { UiState } from "../protocol.js";
import type { NoticeInbox } from "../notices/notice-inbox.js";
import type { EditorStateView } from "./editor-state-view.js";

/** The page's whole state: everything else, and the ended tasks waiting in the notice panel. */
export class NoticeStateView {
  constructor(
    private page: EditorStateView,
    private inbox: Pick<NoticeInbox, "views">,
  ) {}

  state(): UiState {
    return { ...this.page.state(), notices: this.inbox.views() };
  }
}
