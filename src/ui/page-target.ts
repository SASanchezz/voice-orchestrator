// Where a notice's button takes the web UI: the assistant's reply to a session's latest task, or the session itself.
// Written into the link's #hash for a page that opens fresh. No imports, so the page bundles it and Node tests it.

export const PAGE_VIEWS = ["assistant", "session"] as const;
export type PageView = (typeof PAGE_VIEWS)[number];

export interface PageTarget {
  view: PageView;
  sessionId: string;
}

const HASH_KEY = "open";

/** "#open=session:<id>" */
export function pageHash(target: PageTarget): string {
  return `#${HASH_KEY}=${target.view}:${encodeURIComponent(target.sessionId)}`;
}

/** The target in a link's #hash, if it has a valid one. */
export function parsePageHash(hash: string): PageTarget | undefined {
  const match = new RegExp(`^#${HASH_KEY}=(\\w+):(.+)$`).exec(hash);
  const view = PAGE_VIEWS.find((known) => known === match?.[1]);
  return view && match ? { view, sessionId: decodeURIComponent(match[2]) } : undefined;
}
