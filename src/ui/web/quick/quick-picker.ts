// The quick panel's ⌘K list: type a few letters of a project or session ("bil fix"), move with ↑ ↓, pick with ↩ or a
// click; Esc goes back to your message without changing who gets it.

import { matchingOptions, type PickerOption } from "../../picker-match.js";
import type { QuickTarget } from "../../quick-targets.js";
import { byId, el } from "../dom.js";
import { dotOf } from "./quick-header.js";

const NOTHING_FOUND = "No project or session matches";

export class QuickPicker {
  private section = byId("quick-picker", HTMLElement);
  private search = byId("quick-search", HTMLInputElement);
  private list = byId("quick-options", HTMLUListElement);
  private trigger = byId("quick-target", HTMLButtonElement);
  private shown: QuickTarget[] = [];
  private active = 0;

  constructor(
    private everyone: () => QuickTarget[],
    private onPick: (id: string) => void,
  ) {
    this.search.addEventListener("input", () => this.filter());
    this.search.addEventListener("keydown", (e) => this.onKey(e));
  }

  isOpen(): boolean {
    return !this.section.hidden;
  }

  open(): void {
    this.section.hidden = false;
    this.trigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("picking");
    this.search.value = "";
    this.filter();
    this.search.focus();
  }

  close(): void {
    this.section.hidden = true;
    this.trigger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("picking");
  }

  private filter(): void {
    const everyone = this.everyone();
    const targetsById = new Map(everyone.map((target) => [target.id, target]));
    const options = matchingOptions(everyone.map(optionOf), this.search.value);
    this.shown = options.map((option) => targetsById.get(option.value)).filter((target) => target !== undefined);
    this.active = 0;
    this.render();
  }

  private render(): void {
    const rows = this.shown.map((target, place) => this.row(target, place));
    this.list.replaceChildren(...(rows.length ? rows : [el("li", { class: "quick-empty muted" }, NOTHING_FOUND)]));
    const activeId = this.shown.length ? rowIdOf(this.active) : "";
    this.search.setAttribute("aria-activedescendant", activeId);
    this.list.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }

  private row(target: QuickTarget, place: number): HTMLLIElement {
    const isActive = place === this.active;
    const attrs = {
      id: rowIdOf(place),
      role: "option",
      class: isActive ? "active" : "",
      "aria-selected": String(isActive),
    };
    const dot = el("span", { class: `dot ${dotOf(target)}`, "aria-hidden": "true" });
    const row = el("li", attrs, dot, el("span", { class: "quick-option-name" }, target.name));
    row.append(el("span", { class: "quick-option-detail muted" }, target.detail));
    row.addEventListener("mousedown", (e) => e.preventDefault()); // keeps focus in the search box
    row.addEventListener("click", () => this.pick(place));
    row.addEventListener("mousemove", () => this.highlight(place));
    return row;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.isComposing) return;
    const handled = this.handleKey(e.key);
    if (handled) e.preventDefault(); // the page's own Esc must not close the panel too
  }

  private handleKey(key: string): boolean {
    if (key === "ArrowDown") return this.highlight(this.active + 1);
    if (key === "ArrowUp") return this.highlight(this.active - 1);
    if (key === "Enter" || key === "Tab") return this.pick(this.active);
    if (key === "Escape") return this.cancel();
    return false;
  }

  /** Wraps around at either end. */
  private highlight(place: number): boolean {
    if (!this.shown.length) return true;
    this.active = (place + this.shown.length) % this.shown.length;
    this.render();
    return true;
  }

  private pick(place: number): boolean {
    const target = this.shown[place];
    if (!target) return true;
    this.close();
    this.onPick(target.id);
    return true;
  }

  private cancel(): boolean {
    this.close();
    byId("quick-input", HTMLTextAreaElement).focus();
    return true;
  }
}

function optionOf(target: QuickTarget): PickerOption {
  return { value: target.id, label: target.name, detail: target.detail };
}

function rowIdOf(place: number): string {
  return `quick-option-${place}`;
}
