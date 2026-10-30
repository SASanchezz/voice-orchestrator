import type { ServerResponse } from "node:http";
import type { GitChanges } from "../../review/git-changes.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import type { UiAccess } from "./ui-access.js";
import type { UiLookup } from "./ui-lookup.js";

/** What the Review view reads: every project's changed files, and one file's diff when you scroll to it. */
export class ChangesRoutes {
  constructor(
    private access: UiAccess,
    private lookup: UiLookup,
    private changes: GitChanges,
  ) {}

  async all(url: URL, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const projects = this.lookup.projectViews();
    const views = projects.map(({ name, folder }) => this.changes.ofProject(name, folder));
    sendJson(res, await Promise.all(views));
  }

  async fileDiff(url: URL, project: string, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const path = url.searchParams.get("path") ?? "";
    const folder = this.lookup.folderOf(project);
    await requireChanged(this.changes, folder, path);
    sendJson(res, await this.changes.diffOf(folder, path));
  }
}

/** Only files git lists as changed can be read, so a request can't name anything else on this Mac. */
export async function requireChanged(changes: GitChanges, folder: string, path: string): Promise<void> {
  if (!(await changes.isChanged(folder, path))) throw new HttpError(HTTP_STATUS.notFound, `No changes in ${path}`);
}

export function sendJson(res: ServerResponse, payload: unknown): void {
  res.writeHead(HTTP_STATUS.ok, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}
