// Every message box keeps its own unsent text: the assistant's, and each session's. Moving to another session or
// project leaves what you typed with the box you left, and brings back what you typed in the one you come to. Drafts
// live in this page only, so a reload or a restart starts them empty.

import { autoGrow } from "./dom.js";
import { store } from "./store.js";

const ASSISTANT_BOX = "assistant";

export class BoxDrafts {
  private drafts = new Map<string, string>();
  private shownBox = ASSISTANT_BOX;

  /** `isIdle` says no recording is filling the box, whose words belong to where it started. */
  constructor(
    private input: HTMLTextAreaElement,
    private isIdle: () => boolean,
  ) {}

  /** Shows the draft of the box in front: the selected project's active session's, or the assistant's. */
  render(): void {
    const box = BoxDrafts.boxInFront();
    const canSwitch = box !== this.shownBox && this.isIdle();
    if (canSwitch) this.switchTo(box);
  }

  private switchTo(box: string): void {
    this.drafts.set(this.shownBox, this.input.value);
    this.shownBox = box;
    this.input.value = this.drafts.get(box) ?? "";
    autoGrow(this.input);
  }

  private static boxInFront(): string {
    return store.selectedProject()?.activeSession ?? ASSISTANT_BOX;
  }
}
