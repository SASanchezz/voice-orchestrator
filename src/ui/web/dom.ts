// Small DOM helpers. Text is always inserted as text, never as HTML.

/** A child for el(): "" leaves a slot empty. */
export type Child = Node | string;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
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

export function collapsible(summary: string, text: string): HTMLDetailsElement {
  return el("details", { class: "more" }, el("summary", {}, summary), el("p", {}, text));
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

const MAX_COMPOSER_HEIGHT_PX = 200;

export function autoGrow(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_COMPOSER_HEIGHT_PX)}px`;
}

/** An element the page's HTML always has; a missing one is a bug in index.html. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} is missing from the page`);
  return node as T;
}

export function localRead(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function localWrite(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // a remembered selection is a convenience only
  }
}
