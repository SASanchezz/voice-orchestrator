// The closed face of a search picker: the chosen option, its detail muted beside it, and a drop-down mark.

import type { PickerChoice } from "./search-picker.js";
import { el } from "./dom.js";

const NOTHING_CHOSEN = "Pick…";

export function pickerTrigger({ label, options, selected }: PickerChoice): HTMLButtonElement {
  const chosen = options.find((option) => option.value === selected);
  const name = el("span", { class: "search-picker-label" }, chosen?.label ?? NOTHING_CHOSEN);
  const detail = el("span", { class: "search-picker-detail" }, chosen?.detail ?? "");
  const attrs = { type: "button", class: "search-picker-trigger", title: label, "aria-label": label };
  return el("button", attrs, name, detail, el("span", { class: "search-picker-mark", "aria-hidden": "true" }, "▾"));
}
