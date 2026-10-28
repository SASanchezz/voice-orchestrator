// Where the web UI finds VS Code: under its own origin, so the page may frame it. No imports, so the page bundles it
// and Node tests it.

/** The UI server passes everything under this path on to the editor server, which serves under it too. */
export const EDITOR_BASE_PATH = "/editor";

/** VS Code on `folder`; the token is the editor server's connection token, which it trades for a cookie. */
export function editorUrl(folder: string, token: string): string {
  return `${EDITOR_BASE_PATH}/?folder=${encodeURIComponent(folder)}&tkn=${encodeURIComponent(token)}`;
}

/** Whether a request's path is the editor's. */
export function isEditorPath(pathname: string): boolean {
  return pathname === EDITOR_BASE_PATH || pathname.startsWith(`${EDITOR_BASE_PATH}/`);
}
