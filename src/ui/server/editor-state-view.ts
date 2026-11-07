import type { Editor } from "../../editor/editor.js";
import type { UiState } from "../protocol.js";
import type { PageStateView } from "./page-state-view.js";

/** The page's state, with whether VS Code is there for the Code view; NoticeStateView adds the notices. */
export class EditorStateView {
  constructor(
    private page: PageStateView,
    private editor: Pick<Editor, "status">,
  ) {}

  state(): Omit<UiState, "notices"> {
    return { ...this.page.state(), editor: this.editor.status };
  }
}
