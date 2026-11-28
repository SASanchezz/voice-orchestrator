// Files and folders pasted into the message box, shown as chips with their names until the message goes with their
// paths.

import type { ReferencedPath } from "../../attachments/referenced-paths.js";
import { referenceChip } from "./attachment-chips.js";

export class PathReferences {
  private paths: ReferencedPath[] = [];

  constructor(private list: HTMLElement) {}

  /** The paths waiting to be sent, in the order they were pasted. */
  get all(): ReferencedPath[] {
    return [...this.paths];
  }

  /** Adds the paths not there yet. */
  add(pasted: ReferencedPath[]): void {
    const fresh = pasted.filter((item) => !this.has(item.path));
    this.paths.push(...fresh);
    this.render();
  }

  clear(): void {
    this.paths = [];
    this.render();
  }

  private has(path: string): boolean {
    return this.paths.some((kept) => kept.path === path);
  }

  private remove(path: string): void {
    this.paths = this.paths.filter((kept) => kept.path !== path);
    this.render();
  }

  private render(): void {
    this.list.hidden = !this.paths.length;
    this.list.replaceChildren(...this.paths.map((item) => referenceChip(item, () => this.remove(item.path))));
  }
}
