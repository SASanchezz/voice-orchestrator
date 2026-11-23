// The top of the quick panel: who gets your message and what they are doing, and the recent sessions under the box,
// one ⌘-number away each. Everything a worker or the model wrote is inserted as text, never as HTML.

import type { SessionView } from "../../protocol.js";
import { ASSISTANT_TARGET, sessionContextOf, type QuickTarget } from "../../quick-targets.js";
import { firstLine } from "../../session-title.js";
import { byId, el } from "../dom.js";
import { store } from "../store.js";

/** ⌘1 to ⌘5 pick the five most recent sessions. */
export const RECENT_COUNT = 5;
export const ASSISTANT_KEY = "0";
const ASSISTANT_HINT = "Ask the assistant; it can start tasks in any project.";
const ASSISTANT_DOT = "assistant";

export class QuickHeader {
  private latestAssistantReply = "";

  constructor(private onPick: (id: string) => void) {}

  rememberAssistantReply(text: string): void {
    this.latestAssistantReply = firstLine(text);
  }

  render(target: QuickTarget, recent: QuickTarget[]): void {
    byId("quick-target-dot", HTMLElement).className = `dot ${dotOf(target)}`;
    byId("quick-target-name", HTMLElement).textContent = target.name;
    byId("quick-context", HTMLElement).textContent = this.contextOf(target);
    byId("quick-input", HTMLTextAreaElement).placeholder = `Message ${target.name}…`;
    this.renderRecent(target, recent.slice(0, RECENT_COUNT));
  }

  private contextOf(target: QuickTarget): string {
    if (target.id === ASSISTANT_TARGET.id) return this.latestAssistantReply || ASSISTANT_HINT;
    const session = sessionOf(target.id);
    return session ? sessionContextOf(session) : "";
  }

  private renderRecent(target: QuickTarget, recent: QuickTarget[]): void {
    const chips = recent.map((candidate, place) => this.chip(candidate, String(place + 1), target));
    byId("quick-recent", HTMLElement).replaceChildren(...chips, this.chip(ASSISTANT_TARGET, ASSISTANT_KEY, target));
  }

  private chip(candidate: QuickTarget, key: string, target: QuickTarget): HTMLButtonElement {
    const isChosen = String(candidate.id === target.id);
    const attrs = {
      type: "button",
      class: "quick-chip",
      "aria-pressed": isChosen,
      title: `${candidate.name} (⌘${key})`,
    };
    const chip = el("button", attrs, dot(candidate), el("span", { class: "quick-chip-name" }, candidate.name));
    chip.append(el("kbd", {}, `⌘${key}`));
    chip.addEventListener("click", () => this.onPick(candidate.id));
    return chip;
  }
}

function dot(target: QuickTarget): HTMLElement {
  return el("span", { class: `dot ${dotOf(target)}`, "aria-hidden": "true" });
}

export function dotOf(target: QuickTarget): string {
  return target.status ?? ASSISTANT_DOT;
}

function sessionOf(id: string): SessionView | undefined {
  return store.state.projects.flatMap((project) => project.sessions).find((session) => session.id === id);
}
