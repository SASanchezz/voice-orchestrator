// The Messages view's setup checkup: for each messenger, whether replies can work, and what to do when they can't.
// No imports, so the page bundles it.

export type CheckStatus = "ok" | "warn" | "fail";

export interface SetupCheck {
  label: string;
  status: CheckStatus;
  detail: string;
  /** What to do about it, when it isn't ok. */
  fix?: string;
  /** A command to run for the fix, shown with a Copy button. */
  command?: string;
}

export interface SourceCheckup {
  /** e.g. "Slack acme" or "Telegram". */
  source: string;
  checks: SetupCheck[];
}
