// The quick panel's message box: ↩ sends to the chosen session (queued if it is busy) or the assistant, ⌘↩ starts a new
// session of the chosen session's project with it. A sent message says where it went, then the panel puts itself away;
// a refused one keeps your words and says why.

import { ASSISTANT_TARGET, type QuickTarget } from "../../quick-targets.js";
import { isBusyStatus } from "../../running-tasks.js";
import { post } from "../api.js";
import type { DictationBox } from "../dictation-box.js";
import { autoGrow, byId } from "../dom.js";
import type { QuickStatus } from "./quick-status.js";
import type { TargetChoice } from "./target-choice.js";

const NO_PROJECT = "The assistant has no sessions of its own; pick a project's session first (⌘K).";

type Delivery = (text: string) => Promise<unknown>;

export class QuickComposer {
  private sending = false;
  private input = byId("quick-input", HTMLTextAreaElement);

  constructor(
    private box: DictationBox,
    private status: QuickStatus,
    private choice: TargetChoice,
  ) {}

  hasWords(): boolean {
    return this.input.value.trim() !== "";
  }

  async send(): Promise<boolean> {
    const target = this.choice.current();
    const isDelivered = await this.deliver((text) => post(pathOf(target), bodyOf(target, text)), sentNote(target));
    if (isDelivered) this.choice.sentTo(target.id);
    return isDelivered;
  }

  async sendToNewSession(): Promise<boolean> {
    const { project } = this.choice.current();
    if (!project) {
      this.status.problem(NO_PROJECT);
      return false;
    }
    const delivery: Delivery = (text) => post(freshTaskPath(project), { instruction: text });
    const isDelivered = await this.deliver(delivery, `Started a new ${project} session with it.`);
    if (isDelivered) this.choice.sentToNewSession();
    return isDelivered;
  }

  /** Nothing to send, a send already on its way, or words still being heard: nothing happens. */
  private async deliver(delivery: Delivery, note: string): Promise<boolean> {
    const text = this.input.value.trim();
    if (!text || this.sending || !this.box.isIdle()) return false;
    this.sending = true;
    this.status.working("Sending…");
    const isDelivered = await this.attempt(delivery, text, note);
    this.sending = false;
    return isDelivered;
  }

  private async attempt(delivery: Delivery, text: string, note: string): Promise<boolean> {
    try {
      await delivery(text);
    } catch (error) {
      this.status.problem(error instanceof Error ? error.message : String(error));
      return false;
    }
    this.clear();
    this.status.done(note);
    return true;
  }

  private clear(): void {
    this.input.value = "";
    autoGrow(this.input);
  }
}

function pathOf(target: QuickTarget): string {
  return target.id === ASSISTANT_TARGET.id ? "/api/message" : `/api/sessions/${target.id}/tasks`;
}

function bodyOf(target: QuickTarget, text: string): object {
  return target.id === ASSISTANT_TARGET.id ? { text } : { instruction: text };
}

function freshTaskPath(project: string): string {
  return `/api/projects/${encodeURIComponent(project)}/sessions/fresh-task`;
}

/** A busy session queues it, which is worth saying so you don't wait for an answer right away. */
function sentNote(target: QuickTarget): string {
  if (target.id === ASSISTANT_TARGET.id) return "Sent to the assistant.";
  const isBusy = target.status !== undefined && isBusyStatus(target.status);
  return isBusy ? `Queued for ${target.name}; it's busy.` : `Sent to ${target.name}.`;
}
