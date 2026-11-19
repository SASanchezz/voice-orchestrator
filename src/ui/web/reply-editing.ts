// A drafted reply's box starts locked, so a newer copy of the draft can replace it. Clicking the draft or Edit opens it;
// Save keeps the change (and updates Telegram's own draft), Esc puts back what was there and locks it again.

import type { ReplyRequests } from "./reply-requests.js";

export class ReplyEditing {
  private editing = false;
  private saved: string;

  constructor(
    private input: HTMLTextAreaElement,
    private button: HTMLButtonElement,
    private requests: ReplyRequests,
  ) {
    this.saved = input.value;
    button.addEventListener("click", () => void (this.editing ? this.save() : this.unlock()));
    input.addEventListener("click", () => this.unlock());
    input.addEventListener("keydown", (e) => this.cancelOnEscape(e));
    this.lock();
  }

  isEditing(): boolean {
    return this.editing;
  }

  /** A newer copy of the draft, shown while you aren't working on it. */
  show(text: string): void {
    if (this.editing) return;
    this.input.value = text;
    this.saved = text;
  }

  unlock(): void {
    if (this.editing) return;
    this.setEditing(true);
    this.input.focus();
  }

  private async save(): Promise<void> {
    if (!(await this.requests.run("edit", { text: this.input.value }))) return;
    this.saved = this.input.value;
    this.lock();
  }

  private cancelOnEscape(e: KeyboardEvent): void {
    if (e.key !== "Escape" || !this.editing || this.input.readOnly) return; // a recording's Esc is its own
    e.preventDefault();
    this.input.value = this.saved;
    this.lock();
  }

  private lock(): void {
    this.setEditing(false);
  }

  private setEditing(editing: boolean): void {
    this.editing = editing;
    this.input.readOnly = !editing;
    this.input.classList.toggle("editing", editing);
    this.button.textContent = editing ? "Save" : "✎ Edit";
  }
}
