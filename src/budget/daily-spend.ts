import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

/** USD spent by all workers, by local day ("2026-10-14"). */
const spendFileSchema = z.record(z.string(), z.number());
type SpendByDay = z.infer<typeof spendFileSchema>;

/** What all workers spent each day, kept in state/spend.json so a restart doesn't reset today's total. */
export class DailySpend {
  private byDay: SpendByDay;

  constructor(private file: string) {
    this.byDay = existsSync(file) ? readSpend(file) : {};
  }

  add(usd: number, now = new Date()): void {
    const day = localDay(now);
    this.byDay = { ...this.byDay, [day]: (this.byDay[day] ?? 0) + usd };
    writeFileSync(this.file, `${JSON.stringify(this.byDay, null, 2)}\n`);
  }

  spentOn(now = new Date()): number {
    return this.byDay[localDay(now)] ?? 0;
  }
}

/** A damaged file starts the count over rather than stopping the app. */
function readSpend(file: string): SpendByDay {
  const parsed = spendFileSchema.safeParse(parseJson(readFileSync(file, "utf8")));
  return parsed.success ? parsed.data : {};
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
