// Small DOM helpers. Text is always inserted as text, never as HTML.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children.filter((c) => c !== "" && c != null));
  return node;
}

export function button(label, variant, onClick) {
  const node = el("button", { type: "button", class: variant }, label);
  node.addEventListener("click", onClick);
  return node;
}

export function collapsible(summary, text) {
  return el("details", { class: "more" }, el("summary", {}, summary), el("p", {}, text));
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(ms) {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

export function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
}

export function localRead(key) {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function localWrite(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // a remembered selection is a convenience only
  }
}
