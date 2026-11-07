// The reply box: your words go straight to the session the notice is about, as a task typed in the web UI does,
// queued if it is busy. Each session keeps its own draft, so switching notices loses nothing.

import type { NoticeView } from "../../notice-protocol.js";
import type { SessionView } from "../../protocol.js";
import { post } from "../api.js";
import type { DictationBox } from "../dictation-box.js";
import { autoGrow, byId } from "../dom.js";

const SESSION_GONE = "This session was closed, so it can't take a reply.";

export class NoticeReply {
  private drafts = new Map<string, string>();
  private sessionId = "";
  private problem = "";

  constructor(
    private box: DictationBox,
    private input: HTMLTextAreaElement,
  ) {}

  render(notice: NoticeView, session: SessionView | undefined): void {
    if (notice.sessionId !== this.sessionId) this.switchTo(notice);
    byId("reply-fields", HTMLFieldSetElement).disabled = !session;
    byId("reply-status", HTMLElement).textContent = this.problem || statusOf(session);
  }

  /** Typing, dictating, or words waiting in the box: the panel leaves this notice on show. */
  isBusy(): boolean {
    return this.input.value.trim() !== "" || document.activeElement === this.input || !this.box.isIdle();
  }

  async send(): Promise<void> {
    const instruction = this.input.value.trim();
    if (!instruction || !this.box.isIdle()) return;
    this.problem = "";
    try {
      await this.sendToSession(instruction);
    } catch (error) {
      this.problem = error instanceof Error ? error.message : String(error);
      byId("reply-status", HTMLElement).textContent = this.problem;
    }
  }

  private async sendToSession(instruction: string): Promise<void> {
    await post(`/api/sessions/${this.sessionId}/tasks`, { instruction });
    this.input.value = "";
    autoGrow(this.input);
    this.drafts.delete(this.sessionId);
  }

  private switchTo(notice: NoticeView): void {
    if (this.sessionId) this.drafts.set(this.sessionId, this.input.value);
    this.sessionId = notice.sessionId;
    this.problem = "";
    this.input.value = this.drafts.get(notice.sessionId) ?? "";
    this.input.placeholder = `Reply to ${notice.project} session ${notice.sessionNumber}…`;
    autoGrow(this.input);
  }
}

/** What the session is doing with your replies. */
function statusOf(session: SessionView | undefined): string {
  if (!session) return SESSION_GONE;
  if (session.status !== "running" && session.status !== "waiting_permission") return "";
  const queued = session.queued.length ? `; ${session.queued.length} more queued` : "";
  return `Working on it${queued}…`;
}
