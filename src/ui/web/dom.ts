// Small DOM helpers. Text is always inserted as text, never as HTML.

/** A child for el(): "" leaves a slot empty. */
type Child = Node | string;

const MINUTE_MS = 60_000;
/** How long a copy button says "Copied" before it reads "Copy" again. */
const COPIED_MS = 1500;
const MAX_COMPOSER_HEIGHT_PX = 200;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children.filter((c) => c !== ""));
  return node;
}

export function button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", { type: "button", class: variant }, label);
  node.addEventListener("click", onClick);
  return node;
}

/**
 * Copies `text` when clicked and says whether it worked. The clipboard is only there on localhost or https;
 * elsewhere the button says so.
 */
export function copyButton(text: string, title: string): HTMLButtonElement {
  const copy = button("Copy", "ghost copy-button", () => {
    navigator.clipboard.writeText(text).then(
      () => showBriefly(copy, "Copied"),
      () => showBriefly(copy, "Can't copy"),
    );
  });
  copy.title = title;
  return copy;
}

function showBriefly(copy: HTMLButtonElement, label: string): void {
  copy.textContent = label;
  setTimeout(() => (copy.textContent = "Copy"), COPIED_MS);
}

/** Opens a dialog from index.html; `onConfirm` runs once if it closes with its "confirm" button. */
export function confirmInDialog(dialog: HTMLDialogElement, onConfirm: () => void): void {
  dialog.returnValue = "";
  const onClose = (): void => {
    if (dialog.returnValue === "confirm") onConfirm();
  };
  dialog.addEventListener("close", onClose, { once: true });
  dialog.showModal();
  dialog.querySelector<HTMLButtonElement>(".ghost")?.focus(); // Enter must not confirm by accident
}

export function collapsible(summary: string, body: HTMLElement): HTMLDetailsElement {
  return el("details", { class: "more" }, el("summary", {}, summary), body);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / MINUTE_MS);
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

export function autoGrow(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_COMPOSER_HEIGHT_PX)}px`;
}

/** An element the page's HTML always has, of the kind it always is; anything else is a bug in index.html. */
export function byId<T extends HTMLElement>(id: string, kind: new () => T): T {
  const node = document.getElementById(id);
  if (!(node instanceof kind)) throw new Error(`#${id} is missing from the page`);
  return node;
}

/** The first element matching `selector`, which the page's HTML always has. */
export function bySelector<T extends Element>(selector: string, kind: new () => T): T {
  const node = document.querySelector(selector);
  if (!(node instanceof kind)) throw new Error(`${selector} is missing from the page`);
  return node;
}

export function localRead(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function localWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // a remembered selection is a convenience only
  }
}
