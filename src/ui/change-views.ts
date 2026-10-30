// What the Review view reads from the server. No imports, so the server (Node) and the page (browser) both compile it.

export type ChangeKind = "added" | "modified" | "deleted";

/** A file with uncommitted changes. */
export interface ChangedFileView {
  /** From the repository's root. */
  path: string;
  kind: ChangeKind;
  additions: number;
  deletions: number;
  /** All of its changes are staged. */
  staged: boolean;
  /** Differs once the file changes again, so a "reviewed" mark stops counting. */
  fingerprint: string;
}

/** A project's uncommitted changes. */
export interface ProjectChangesView {
  project: string;
  isRepository: boolean;
  files: ChangedFileView[];
  /** Changed files left out of `files` because there are too many to list. */
  moreFiles: number;
}

/** One changed file's diff, or why it isn't shown. */
export interface FileDiffView {
  path: string;
  patch: string;
  notShownReason?: string;
}
