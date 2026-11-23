// The comment box under a file's diff: what you write starts a new session of the project as its task, naming the file
// and the line you clicked, so each question is answered fresh without the context of earlier work. 🎙 lets you say it.

import { reviewComment } from "../reviewed-files.js";
import { act } from "./api.js";
import { commentDictation } from "./comment-dictation.js";
import { el } from "./dom.js";
import { store } from "./store.js";

const COMMENTED_CLASS = "commented";

export class CommentBox {
  readonly box: HTMLFormElement;
  private readonly input = el("textarea", { rows: "1", placeholder: "Tell the worker about this file…" });
  private aimedRow: HTMLElement | undefined;
  private aimedLine: number | undefined;

  constructor(private readonly path: string) {
    const send = el("button", { type: "submit", class: "primary" }, "Send to worker"); // held back while recording
    this.box = el("form", { class: "diff-comment" }, this.input);
    const voice = commentDictation({ form: this.box, input: this.input, send }, this.send);
    this.box.append(...voice, send);
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
    this.input.placeholder = "Sent to a new session. Ask something else…";
  }
}

/** Opens a new session of the project for it, which becomes the active one. */
async function sendToWorker(instruction: string): Promise<boolean> {
  const project = store.selectedProject();
  if (!project) return false;
  const path = `/api/projects/${encodeURIComponent(project.name)}/sessions/fresh-task`;
  return (await act(path, { instruction })) !== undefined;
}
