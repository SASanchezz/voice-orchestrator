// A search picker's list: the options matching what you typed, one of them active for the arrow keys and Enter.

import { matchingOptions, type PickerOption } from "../picker-match.js";
import { el } from "./dom.js";

const NO_MATCHES = "No matches";

export class PickerList {
  readonly element = el("ul", { class: "search-picker-list", role: "listbox" });
  private shown: PickerOption[] = [];
  private active = 0;

  constructor(
    private options: PickerOption[],
    private selected: string,
    private onPick: (value: string) => void,
  ) {}

  /** Starts on the selected option while nothing is typed, else on the best match. */
  filter(query: string): void {
    this.shown = matchingOptions(this.options, query);
    const selectedIndex = this.shown.findIndex((option) => option.value === this.selected);
    this.active = query || selectedIndex < 0 ? 0 : selectedIndex;
    this.render();
  }

  move(step: number): void {
    const last = this.shown.length - 1;
    this.active = Math.max(0, Math.min(last, this.active + step));
    this.render();
  }

  pickActive(): void {
    const option = this.shown.at(this.active);
    if (option) this.onPick(option.value);
  }

  private render(): void {
    if (!this.shown.length) return this.element.replaceChildren(el("li", { class: "muted" }, NO_MATCHES));
    this.element.replaceChildren(...this.shown.map((option, index) => this.row(option, index)));
    this.element.children[this.active]?.scrollIntoView({ block: "nearest" });
  }

  private row(option: PickerOption, index: number): HTMLLIElement {
    const isActive = index === this.active;
    const isSelected = option.value === this.selected;
    const classes = ["search-picker-option", isActive ? "active" : "", isSelected ? "selected" : ""];
    const label = el("span", { class: "search-picker-label" }, option.label);
    const detail = el("span", { class: "search-picker-detail" }, option.detail);
    const row = el("li", { class: classes.join(" "), role: "option" }, label, detail);
    row.setAttribute("aria-selected", String(isSelected));
    row.addEventListener("mousedown", (event) => event.preventDefault()); // keeps the search box focused
    row.addEventListener("click", () => this.onPick(option.value));
    return row;
  }
}
