import type { LimitsConfig } from "../config/limits-config.js";
import { isResetTime, resetTimeAfter } from "./reset-time.js";
import type { SavedTodo } from "./todo-file.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/**
 * Which saved tasks are due to run again: their limit has reset (plus a few minutes' grace),
 * and they are recent enough that you would still want them.
 */
export class ResumePolicy {
  constructor(private settings: LimitsConfig) {}

  get checkEveryMs(): number {
    return this.settings.checkMinutes * MINUTE_MS;
  }

  /** Oldest first, as they were saved. */
  due(saved: SavedTodo[], now: Date): SavedTodo[] {
    return saved.filter((todo) => this.isDue(todo, now));
  }

  private isDue(todo: SavedTodo, now: Date): boolean {
    const hasReset = this.resumeTimeOf(todo) <= now;
    return hasReset && this.isRecent(todo, now);
  }

  /** When the account should be back: its reset time if the error named one, else a while after the task was saved. */
  resumeTimeOf(todo: SavedTodo): Date {
    const back = this.backTimeOf(todo);
    return new Date(back.getTime() + this.settings.graceMinutes * MINUTE_MS);
  }

  private backTimeOf({ savedAt, resetsAt }: SavedTodo): Date {
    const saved = new Date(savedAt);
    if (resetsAt && isResetTime(resetsAt)) return resetTimeAfter(resetsAt, saved);
    return new Date(saved.getTime() + this.settings.unknownResetMinutes * MINUTE_MS);
  }

  private isRecent(todo: SavedTodo, now: Date): boolean {
    const ageMs = now.getTime() - new Date(todo.savedAt).getTime();
    return ageMs <= this.settings.maxAgeHours * HOUR_MS;
  }
}
