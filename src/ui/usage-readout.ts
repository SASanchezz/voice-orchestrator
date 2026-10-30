// How the top bar words and colours an account's usage. Imports only types and page-safe helpers, so the page bundles it and Node tests it.

import type { BudgetLevel } from "../budget/budget-levels.js";
import type { AccountUsageView, UsageWindowView } from "./plan-usage-views.js";
import { formatWhen } from "./when.js";

const WARN_REMAINING_PERCENT = 25;
const CRITICAL_REMAINING_PERCENT = 10;
const FIVE_HOUR_LIMIT = { label: "5h", limitName: "5-hour" };
const WEEKLY_LIMIT = { label: "Week", limitName: "weekly" };

interface LimitName {
  label: string;
  limitName: string;
}

export interface UsageReadoutItem {
  label: string;
  percentText: string;
  level: BudgetLevel;
  /** "54% of the 5-hour limit left, resets 15:50" */
  title: string;
}

export function usageReadout(usage: AccountUsageView, now: Date): UsageReadoutItem[] {
  const fiveHour = usage.fiveHour && readoutItem(FIVE_HOUR_LIMIT, usage.fiveHour, now);
  const week = usage.week && readoutItem(WEEKLY_LIMIT, usage.week, now);
  return [fiveHour, week].filter((item) => item !== undefined);
}

function readoutItem({ label, limitName }: LimitName, window: UsageWindowView, now: Date): UsageReadoutItem {
  const percentText = `${window.remainingPercent}%`;
  const resets = window.resetsAt ? `, resets ${formatWhen(new Date(window.resetsAt), now)}` : "";
  const title = `${percentText} of the ${limitName} limit left${resets}`;
  return { label, percentText, level: remainingLevel(window.remainingPercent), title };
}

function remainingLevel(remainingPercent: number): BudgetLevel {
  if (remainingPercent <= CRITICAL_REMAINING_PERCENT) return "critical";
  return remainingPercent <= WARN_REMAINING_PERCENT ? "warn" : "ok";
}
