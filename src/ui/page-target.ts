// Where a notice's button takes the web UI: the assistant's reply to a session's latest task, or the session itself.
// Written into the link's #hash for a page that opens fresh. No imports, so the page bundles it and Node tests it.
// By voice, the web UI can also show a project's chat or its code.

export const PAGE_VIEWS = ["assistant", "session"] as const;
export type PageView = (typeof PAGE_VIEWS)[number];

export interface PageTarget {
  view: PageView;
  sessionId: string;
}

export const PROJECT_VIEWS = ["chat", "code"] as const;
/** chat: the project's session chat; code: VS Code on its folder. */
export type ProjectViewName = (typeof PROJECT_VIEWS)[number];

export interface ProjectTarget {
  view: ProjectViewName;
  project: string;
}

export function isProjectTarget(target: PageTarget | ProjectTarget): target is ProjectTarget {
  return "project" in target;
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
