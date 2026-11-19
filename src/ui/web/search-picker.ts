// A drop-down you can type into: click it (or focus it and start typing), type any part of a name, then pick with a
// click or the arrow keys and Enter. Escape or clicking elsewhere closes it without changing anything. Used where a
// plain select is too long to scan: a repository's branches, a folder's repositories.

import type { PickerOption } from "../picker-match.js";
import { el } from "./dom.js";
import { PickerList } from "./picker-list.js";
import { pickerTrigger } from "./picker-trigger.js";

/** What the picker chooses between and which option is chosen now. */
export interface PickerChoice {
  label: string;
  options: PickerOption[];
  selected: string;
}

const OPEN_CLASS = "open";
/** Whether a pressed key typed a character, so typing on the closed picker opens it with that letter. */
const PRINTABLE_KEY = /^\S$/;

export function searchPicker(choice: PickerChoice, onPick: (value: string) => void): HTMLDivElement {
  return new SearchPicker(choice, onPick).element;
}

/** Whether a picker inside `container` is open, so redrawing it now would close it under you. */
export function hasOpenPicker(container: HTMLElement): boolean {
  return container.querySelector(`.search-picker.${OPEN_CLASS}`) !== null;
}

class SearchPicker {
  readonly element: HTMLDivElement;
  private readonly input = el("input", { type: "search", class: "search-picker-input", autocomplete: "off" });
  private readonly list: PickerList;
  private readonly popover: HTMLDivElement;

  constructor(
    private choice: PickerChoice,
    private onPick: (value: string) => void,
  ) {
    this.list = new PickerList(choice.options, choice.selected, (value) => this.pick(value));
    this.popover = el("div", { class: "search-picker-popover" }, this.input, this.list.element);
    this.popover.hidden = true;
    this.input.placeholder = `Search ${choice.options.length} · ↑↓ Enter`;
    this.element = el("div", { class: "search-picker" }, this.trigger(), this.popover);
    this.input.addEventListener("input", () => this.list.filter(this.input.value));
    this.input.addEventListener("keydown", (event) => this.onSearchKey(event));
    this.input.addEventListener("blur", () => this.close());
  }

  private trigger(): HTMLButtonElement {
    const trigger = pickerTrigger(this.choice);
    trigger.addEventListener("click", () => this.open(""));
    trigger.addEventListener("keydown", (event) => this.openOnTyping(event));
    return trigger;
  }

  private openOnTyping(event: KeyboardEvent): void {
    const isTyping = PRINTABLE_KEY.test(event.key) && !event.metaKey && !event.ctrlKey;
    if (!isTyping) return;
    event.preventDefault();
    this.open(event.key);
  }

  private open(query: string): void {
    this.popover.hidden = false;
    this.element.classList.add(OPEN_CLASS);
    this.input.value = query;
    this.list.filter(query);
    this.input.focus();
  }

  private close(): void {
    this.popover.hidden = true;
    this.element.classList.remove(OPEN_CLASS);
  }

  private pick(value: string): void {
    this.close();
    if (value !== this.choice.selected) this.onPick(value);
  }

  private onSearchKey(event: KeyboardEvent): void {
    const action = SEARCH_KEYS[event.key];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation(); // Escape here closes the picker, not the view behind it
    action(this.list, this.input);
  }
}

/** Blurring the search box closes the picker. */
const SEARCH_KEYS: Record<string, (list: PickerList, input: HTMLInputElement) => void> = {
  ArrowDown: (list) => list.move(1),
  ArrowUp: (list) => list.move(-1),
  Enter: (list) => list.pickActive(),
  Escape: (_list, input) => input.blur(),
};
