// One worker session's chat in the center: its lines, with the worker's steps folded into blocks you can open
// and the permission requests they raised under each block's summary.

import type { ChatMessageView, PendingRequestView } from "../protocol.js";
import { type SessionRow, sessionRows, type StepsRow, stepsSummary, unchangedRowCount } from "../session-steps.js";
import { allSteps } from "../step-tree.js";
import { emptySessionItem, sessionItem } from "./chat-items.js";
import type { ChatList } from "./chat-list.js";
import { el, formatTime } from "./dom.js";
import { approvalLines, markPendingApprovals, stepItem } from "./step-items.js";
import { store } from "./store.js";

export class SessionFeed {
  private sessionId = "";
  private messages: ChatMessageView[] = [];
  private shownRows: SessionRow[] = [];
  /** Blocks you opened, by session and block, so redrawing a growing block or coming back keeps them open. */
  private openBlocks = new Set<string>();

  constructor(private list: ChatList) {}

  /** Shows this session's chat, empty until its messages arrive. */
  start(sessionId: string): void {
    this.sessionId = sessionId;
    this.messages = [];
    this.shownRows = [];
    this.list.render([]);
  }

  showEmpty(): void {
    this.list.render([emptySessionItem()]);
  }

  /** The session's chat was wiped on the server; its message ids start over, so its blocks are forgotten. */
  clear(): void {
    const prefix = `${this.sessionId}#`;
    this.openBlocks.forEach((block) => block.startsWith(prefix) && this.openBlocks.delete(block));
    this.start(this.sessionId);
    this.showEmpty();
  }

  /** A new line; only the rows it changed are drawn again. */
  add(message: ChatMessageView): void {
    if (message.id <= (this.messages.at(-1)?.id ?? 0)) return;
    if (!this.messages.length) this.list.render([]);
    this.messages.push(message);
    const rows = sessionRows(this.messages);
    const unchanged = unchangedRowCount(this.shownRows, rows);
    this.list.replaceAfter(
      unchanged,
      rows.slice(unchanged).map((row) => this.rowItem(row)),
    );
    this.shownRows = rows;
    this.showPendingApprovals(store.state.pending);
  }

  showPendingApprovals(pending: PendingRequestView[]): void {
    markPendingApprovals(this.list.findAll(".step-approval"), pending);
  }

  private rowItem(row: SessionRow): HTMLLIElement {
    return row.kind === "line" ? sessionItem(row.message) : this.stepsItem(row);
  }

  private stepsItem(row: StepsRow): HTMLLIElement {
    const block = `${this.sessionId}#${row.key}`;
    const details = el(
      "details",
      { class: "more steps" },
      el("summary", {}, stepsSummary(row.steps)),
      el("ol", { class: "steps-list" }, ...row.steps.map(stepItem)),
    );
    details.open = this.openBlocks.has(block);
    details.addEventListener("toggle", () => this.remember(block, details.open));
    return el("li", { class: "entry event steps-entry" }, stepsMeta(row), details, ...approvalLines(row.steps));
  }

  private remember(block: string, open: boolean): void {
    if (open) this.openBlocks.add(block);
    else this.openBlocks.delete(block);
  }
}

function stepsMeta(row: StepsRow): HTMLDivElement {
  const latest = allSteps(row.steps).at(-1)?.message;
  return el(
    "div",
    { class: "entry-meta" },
    el("span", {}, "Steps"),
    el("span", {}, latest ? formatTime(latest.at) : ""),
  );
}
