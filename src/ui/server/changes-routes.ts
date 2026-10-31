import type { ServerResponse } from "node:http";
import { z } from "zod";
import { StaleFileError } from "../../review/file-lines.js";
import type { GitChanges, LinesRequest } from "../../review/git-changes.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import type { UiAccess } from "./ui-access.js";
import type { UiLookup } from "./ui-lookup.js";

const linesQuery = z
  .object({
    from: z.coerce.number().int().positive(),
    to: z.coerce.number().int().positive(),
    fingerprint: z.string().min(1),
  })
  .refine(({ from, to }) => from <= to);

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

  async hiddenLines(url: URL, project: string, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const path = url.searchParams.get("path") ?? "";
    const folder = this.lookup.folderOf(project);
    await requireChanged(this.changes, folder, path);
    const request = linesQuery.parse(Object.fromEntries(url.searchParams));
    sendJson(res, await this.readHidden(folder, path, request));
  }

  private async readHidden(folder: string, path: string, request: LinesRequest): Promise<string[]> {
    try {
      return await this.changes.hiddenLines(folder, path, request);
    } catch (e) {
      if (e instanceof StaleFileError) throw new HttpError(HTTP_STATUS.conflict, e.message);
      throw e;
    }
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
