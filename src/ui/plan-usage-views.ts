// What the top bar's usage readout reads from the server. No imports, so the server (Node) and the page (browser) both compile it.

/** One of an account's plan limits. */
export interface UsageWindowView {
  remainingPercent: number;
  /** ISO time. */
  resetsAt?: string;
}

/** How much of its plan an account has left; a limit is missing when the account has none or it couldn't be read. */
export interface AccountUsageView {
  account: string;
  fiveHour?: UsageWindowView;
  week?: UsageWindowView;
}
