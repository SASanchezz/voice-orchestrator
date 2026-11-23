// The quick panel's one status line, under the box: on its way, sent, or why it was refused. Announced politely to
// screen readers; a problem stays until you type or send again.

import { byId } from "../dom.js";

type Tone = "working" | "done" | "problem";

export class QuickStatus {
  private line = byId("quick-status", HTMLElement);

  working(text: string): void {
    this.show(text, "working");
  }

  done(text: string): void {
    this.show(text, "done");
  }

  problem(text: string): void {
    this.show(text, "problem");
  }

  clear(): void {
    this.line.textContent = "";
    this.line.className = "quick-status";
  }

  private show(text: string, tone: Tone): void {
    this.line.textContent = text;
    this.line.className = `quick-status ${tone}`;
  }
}
