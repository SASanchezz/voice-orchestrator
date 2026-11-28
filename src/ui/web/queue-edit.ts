// Editing a queued task in the queue strip, before it runs. An edit in progress outlives the strip being drawn again,
// until it is saved or cancelled.

import type { QueueItem } from "../../workers/queued-task.js";
import { act } from "./api.js";
import { autoGrow, button, el } from "./dom.js";

export class QueueEdit {
  /** Edits in progress, by task id. */
  private static drafts = new Map<string, string>();

  /** `finish` gets the instruction the row shows next: the saved one, or the old one when cancelled. */
  constructor(
    private path: string,
    private item: QueueItem,
    private finish: (instruction: string) => void,
  ) {}

  static isEditing(taskId: string): boolean {
    return QueueEdit.drafts.has(taskId);
  }

  static start({ id, instruction }: QueueItem): void {
    QueueEdit.drafts.set(id, instruction);
  }

  elements(): HTMLElement[] {
    const { id } = this.item;
    const editor = el("textarea", { class: "queue-editor", rows: "1", "aria-label": "Queued task" });
    editor.value = QueueEdit.drafts.get(id) ?? this.item.instruction;
    editor.addEventListener("input", () => QueueEdit.drafts.set(id, editor.value));
    editor.addEventListener("keydown", (event) => this.onKey(event, editor));
    requestAnimationFrame(() => autoGrow(editor));
    const save = queueButton("Save", "Save (↩)", () => void this.save(editor.value));
    return [editor, save, queueButton("Cancel", "Cancel (Esc)", () => this.cancel())];
  }

  /** ↩ saves and ⇧↩ starts a new line, as in the message box; Esc goes no further than this edit. */
  private onKey(event: KeyboardEvent, editor: HTMLTextAreaElement): void {
    const isSave = event.key === "Enter" && !event.shiftKey && !event.isComposing;
    const isCancel = event.key === "Escape";
    if (!isSave && !isCancel) return;
    event.preventDefault();
    event.stopPropagation();
    if (isSave) void this.save(editor.value);
    else this.cancel();
  }

  /** Kept as you wrote it when the server refuses, for instance because the task started meanwhile. */
  private async save(text: string): Promise<void> {
    const instruction = text.trim();
    if (!instruction) return;
    if ((await act(`${this.path}/edit`, { instruction })) === undefined) return;
    QueueEdit.drafts.delete(this.item.id);
    this.finish(instruction);
  }

  private cancel(): void {
    QueueEdit.drafts.delete(this.item.id);
    this.finish(this.item.instruction);
  }
}

export function queueButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const node = button(label, "ghost queue-button", onClick);
  node.title = title;
  node.setAttribute("aria-label", title);
  return node;
}
