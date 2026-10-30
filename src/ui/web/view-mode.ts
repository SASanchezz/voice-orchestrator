// Code, Split or Agent: how the selected project's code and chat share the page, and the bottom strip's Chat button,
// which slides the chat over the code in Code mode.

import { byId, bySelector } from "./dom.js";
import { markSegment } from "./indicators.js";
import { store, type ViewMode } from "./store.js";

const MODE_CLASSES: Record<ViewMode, string> = { code: "mode-code", split: "mode-split", agent: "mode-agent" };

export function wireViewMode(): void {
  byId("view-mode", HTMLElement).addEventListener("click", (e) => {
    const value = e.target instanceof Element ? e.target.closest("button")?.dataset.value : undefined;
    if (value === "code" || value === "split" || value === "agent") store.setViewMode(value);
  });
  byId("chat-toggle", HTMLButtonElement).addEventListener("click", () => store.toggleChatOverlay());
  wireSettingsClose();
}

/** A click outside the settings closes them. */
function wireSettingsClose(): void {
  const settings = byId("settings", HTMLDetailsElement);
  document.addEventListener("click", (e) => {
    if (e.target instanceof Node && !settings.contains(e.target)) settings.open = false;
  });
}

export function renderViewMode(): void {
  const layout = bySelector("main.layout", HTMLElement);
  const hasCode = layout.classList.contains("ide-mode");
  for (const [mode, name] of Object.entries(MODE_CLASSES)) layout.classList.toggle(name, mode === store.viewMode);
  layout.classList.toggle("chat-overlaid", store.chatOverlaid);
  layout.classList.toggle("review-shown", store.reviewShown);
  byId("view-mode", HTMLElement).hidden = !hasCode;
  markSegment("view-mode", store.reviewShown ? "" : store.viewMode);
  renderChatToggle(hasCode);
}

function renderChatToggle(hasCode: boolean): void {
  const toggle = byId("chat-toggle", HTMLButtonElement);
  toggle.hidden = !hasCode || store.viewMode !== "code" || store.reviewShown;
  toggle.textContent = store.chatOverlaid ? "Hide chat" : "Chat";
}
