// One task in the queue strip: its place and instruction, with buttons to run it next, edit it or remove it.

import type { QueueItem } from "../../workers/queued-task.js";
import { act } from "./api.js";
import { el } from "./dom.js";
import { QueueEdit, queueButton } from "./queue-edit.js";

/** A queued task where the strip shows it: its place counts from 0. */
interface QueuedPlace {
  sessionId: string;
  item: QueueItem;
  index: number;
}

export class QueueRow {
  readonly element = el("li", { class: "queue-row" });

  constructor(private place: QueuedPlace) {
    if (QueueEdit.isEditing(place.item.id)) this.showEditor();
    else this.showText();
  }

  private get path(): string {
    return `/api/sessions/${this.place.sessionId}/queue/${this.place.item.id}`;
  }

  private showText(): void {
    const { instruction } = this.place.item;
    const text = el("span", { class: "queue-text", title: instruction }, instruction);
    this.element.replaceChildren(this.placeLabel(), text, ...this.buttons());
  }

  private buttons(): HTMLButtonElement[] {
    const isFirst = this.place.index === 0;
    const next = queueButton("↑", "Run this one next", () => void act(`${this.path}/next`));
    const edit = queueButton("✎", "Edit it before it runs", () => this.startEditing());
    const remove = queueButton("×", "Remove it from the queue", () => void act(`${this.path}/remove`));
    return isFirst ? [edit, remove] : [next, edit, remove];
  }

  private startEditing(): void {
    QueueEdit.start(this.place.item);
    this.showEditor();
    this.element.querySelector("textarea")?.focus();
  }

  private showEditor(): void {
    const edit = new QueueEdit(this.path, this.place.item, (instruction) => this.showFinished(instruction));
    this.element.replaceChildren(this.placeLabel(), ...edit.elements());
  }

  private showFinished(instruction: string): void {
    this.place = { ...this.place, item: { ...this.place.item, instruction } };
    this.showText();
  }

  private placeLabel(): HTMLSpanElement {
    return el("span", { class: "queue-place" }, `#${this.place.index + 1}`);
  }
}
