// The comment box under a file's diff: what you write goes to the project's active session as a task, naming the file
// and the line you clicked.

import { reviewComment } from "../reviewed-files.js";
import { act } from "./api.js";
import { button, el } from "./dom.js";
import { activeSession, store } from "./store.js";

const COMMENTED_CLASS = "commented";

export class CommentBox {
  readonly box: HTMLFormElement;
  private readonly input = el("textarea", { rows: "1", placeholder: "Tell the worker about this file…" });
  private aimedRow: HTMLElement | undefined;
  private aimedLine: number | undefined;

  constructor(private readonly path: string) {
    this.box = el("form", { class: "diff-comment" }, this.input, button("Send to worker", "primary", this.send));
    this.box.addEventListener("submit", (event) => {
      event.preventDefault();
      this.send();
    });
  }

  /** Points the comment at a clicked line. */
  aimAt(row: HTMLElement, newLine: number | undefined): void {
    this.aimedRow?.classList.remove(COMMENTED_CLASS);
    this.aimedRow = row;
    this.aimedLine = newLine;
    row.classList.add(COMMENTED_CLASS);
    this.input.placeholder = newLine === undefined ? "About this removed line…" : `About line ${newLine}…`;
    this.input.focus();
  }

  private readonly send = (): void => void this.sendComment();

  private async sendComment(): Promise<void> {
    const comment = this.input.value.trim();
    if (!comment || !(await sendToWorker(reviewComment(this.path, this.aimedLine, comment)))) return;
    this.input.value = "";
    this.input.placeholder = "Sent. Tell the worker something else…";
  }
}

/** Goes to the project's active session; a busy one queues it. */
async function sendToWorker(instruction: string): Promise<boolean> {
  const project = store.selectedProject();
  if (!project) return false;
  const session = activeSession(project);
  return (await act(`/api/sessions/${session.id}/tasks`, { instruction })) !== undefined;
}
