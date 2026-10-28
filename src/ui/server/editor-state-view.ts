import type { Editor } from "../../editor/editor.js";
import type { UiState } from "../protocol.js";
import type { PageStateView } from "./page-state-view.js";

/** The page's whole state, with whether VS Code is there for the Code view. */
export class EditorStateView {
  constructor(
    private page: PageStateView,
    private editor: Pick<Editor, "status">,
  ) {}

  state(): UiState {
    return { ...this.page.state(), editor: this.editor.status };
  }
}
