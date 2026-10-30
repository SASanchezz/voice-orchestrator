import type { AccountUsageView } from "../ui/plan-usage-views.js";
import type { PlanUsageReader } from "./plan-usage-reader.js";

const FRESH_MS = 60_000;

/** The accounts' usage, read at most once a minute however many pages ask: each read starts Claude Code per account. */
export class RecentPlanUsage {
  private latest?: Promise<AccountUsageView[]>;
  private readAt = 0;

  constructor(
    private reader: Pick<PlanUsageReader, "readAll">,
    private now: () => number = Date.now,
  ) {}

  all(): Promise<AccountUsageView[]> {
    if (this.latest && this.now() - this.readAt < FRESH_MS) return this.latest;
    this.readAt = this.now();
    this.latest = this.reader.readAll();
    return this.latest;
  }
}
