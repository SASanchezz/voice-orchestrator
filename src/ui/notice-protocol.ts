// What the notice panel shows and what its buttons ask for. No imports, so the page bundles it and Node tests it.

/** The web UI views a notice's buttons open. */
export const NOTICE_TARGETS = ["assistant", "session", "review"] as const;
export type NoticeTarget = (typeof NOTICE_TARGETS)[number];

/** A task that ended, waiting in the notice panel until you close it. */
export interface NoticeView {
  id: string;
  sessionId: string;
  project: string;
  sessionNumber: number;
  outcome: "done" | "failed";
  /** "acme-web session 3 done: add a countdown", as it is said aloud. */
  headline: string;
  task: string;
  /** The plain-language summary that ends the worker's closing note, or the error. */
  summary: string;
  /** The whole closing note; empty when the summary already is all of it. */
  fullNote: string;
  /** A longer written explanation of the changes, once you asked for one. */
  explanation?: string;
  /** You clicked or typed in it: it no longer closes by itself. */
  seen: boolean;
  /** ISO time. */
  endedAt: string;
}
