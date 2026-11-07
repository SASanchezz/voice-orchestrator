import { EventEmitter } from "node:events";
import type { TaskEndEvent } from "../../events/app-events.js";
import type { NoticeView } from "../notice-protocol.js";
import { HTTP_STATUS, HttpError } from "../server/http-error.js";
import { noticeViewOf, type TaskNotice } from "./notice-view.js";

/** More than this and the oldest goes: the panel is for what just happened, the web UI keeps the rest. */
const MAX_NOTICES = 10;
const GONE = "That notice was closed.";

/**
 * The ended tasks waiting in the notice panel, oldest first. A session's newer ending takes the place of its older one,
 * so the panel shows each session once. Emits "changed" on every change.
 */
export class NoticeInbox extends EventEmitter {
  private notices: TaskNotice[] = [];
  private count = 0;

  add(event: TaskEndEvent): void {
    const notice = { id: `n${++this.count}`, event, endedAt: new Date().toISOString(), seen: false };
    const others = this.notices.filter((n) => n.event.session !== event.session);
    this.notices = [...others, notice].slice(-MAX_NOTICES);
    this.emit("changed");
  }

  /** Closing one that is already gone does nothing: it may close by itself as you click. */
  dismiss(id: string): void {
    this.notices = this.notices.filter((n) => n.id !== id);
    this.emit("changed");
  }

  markSeen(id: string): void {
    this.require(id).seen = true;
    this.emit("changed");
  }

  explained(id: string, explanation: string): void {
    this.require(id).explanation = explanation;
    this.emit("changed");
  }

  has(id: string): boolean {
    return this.notices.some((n) => n.id === id);
  }

  eventOf(id: string): TaskEndEvent {
    return this.require(id).event;
  }

  isEmpty(): boolean {
    return this.notices.length === 0;
  }

  views(): NoticeView[] {
    return this.notices.map(noticeViewOf);
  }

  private require(id: string): TaskNotice {
    const notice = this.notices.find((n) => n.id === id);
    if (!notice) throw new HttpError(HTTP_STATUS.notFound, GONE);
    return notice;
  }
}
