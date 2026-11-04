// Where a notice's button takes the web UI: the assistant's reply to a session's latest task, the session itself,
// or the project's changes in Review.
// Written into the link's #hash for a page that opens fresh. No imports, so the page bundles it and Node tests it.
// By voice, the web UI can also show a project's chat, its code or its changes.

export const PAGE_VIEWS = ["assistant", "session"] as const;
export type PageView = (typeof PAGE_VIEWS)[number];

export interface PageTarget {
  view: PageView;
  sessionId: string;
}

export const PROJECT_VIEWS = ["chat", "code", "review"] as const;
/** chat: the project's session chat; code: VS Code on its folder; review: its uncommitted changes. */
export type ProjectViewName = (typeof PROJECT_VIEWS)[number];

export interface ProjectTarget {
  view: ProjectViewName;
  project: string;
}

/** Anywhere the web UI can be taken: a session's view or a project's. */
export type NavigationTarget = PageTarget | ProjectTarget;

export function isProjectTarget(target: NavigationTarget): target is ProjectTarget {
  return "project" in target;
}

const HASH_KEY = "open";

/** "#open=session:<id>", or "#open=review:<project>" */
export function pageHash(target: NavigationTarget): string {
  const subject = isProjectTarget(target) ? target.project : target.sessionId;
  return `#${HASH_KEY}=${target.view}:${encodeURIComponent(subject)}`;
}

/** The target in a link's #hash, if it has a valid one. */
export function parsePageHash(hash: string): NavigationTarget | undefined {
  const match = new RegExp(`^#${HASH_KEY}=(\\w+):(.+)$`).exec(hash);
  if (!match) return undefined;
  return targetOf(match[1], decodeURIComponent(match[2]));
}

/** A session's view of that session, or a project's view of that project; any other view is no target. */
function targetOf(viewName: string, subject: string): NavigationTarget | undefined {
  const view = PAGE_VIEWS.find((known) => known === viewName);
  if (view) return { view, sessionId: subject };
  const projectView = PROJECT_VIEWS.find((known) => known === viewName);
  return projectView ? { view: projectView, project: subject } : undefined;
}
