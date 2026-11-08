import type { ServerResponse } from "node:http";
import { z } from "zod";
import type { BranchCompare } from "../../review/branch-compare.js";
import { errorMessage } from "../../shared/errors.js";
import type { ComparisonView, ProjectChangesView } from "../change-views.js";
import { linesQuery, sendJson } from "./changes-routes.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import type { UiAccess } from "./ui-access.js";
import type { UiLookup } from "./ui-lookup.js";

/** A leading dash would read as an option to git. */
const branchName = z
  .string()
  .min(1)
  .refine((name) => !name.startsWith("-"));
const comparisonQuery = z.object({ base: branchName, head: branchName });
/** The fingerprint of a branch's diff is the head commit its hidden lines are read from. */
const comparedLinesQuery = linesQuery.and(z.object({ fingerprint: z.string().regex(/^[0-9a-f]{40}([0-9a-f]{24})?$/) }));

/** What the Review view reads to compare two branches: the branches, the files that differ, and one file's diff. */
export class CompareRoutes {
  constructor(
    private access: UiAccess,
    private lookup: UiLookup,
    private compare: BranchCompare,
  ) {}

  async branches(url: URL, project: string, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    sendJson(res, await this.compare.branchesOf(this.lookup.folderOf(project)));
  }

  async files(url: URL, project: string, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    sendJson(res, await this.readFiles(project, comparisonOf(url)));
  }

  async fileDiff(url: URL, project: string, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const [folder, comparison, path] = await this.requireCompared(url, project);
    sendJson(res, await this.compare.diffOf(folder, comparison, path));
  }

  async hiddenLines(url: URL, project: string, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const [folder, , path] = await this.requireCompared(url, project);
    const request = comparedLinesQuery.parse(Object.fromEntries(url.searchParams));
    sendJson(res, await this.compare.hiddenLines(folder, path, request));
  }

  /** A branch that doesn't exist is a missing page, not a broken server. */
  private async readFiles(project: string, comparison: ComparisonView): Promise<ProjectChangesView> {
    try {
      return await this.compare.ofProject(project, this.lookup.folderOf(project), comparison);
    } catch (e) {
      throw new HttpError(HTTP_STATUS.notFound, errorMessage(e));
    }
  }

  /** Only files that differ between the branches can be read, so a request can't name anything else. */
  private async requireCompared(url: URL, project: string): Promise<ComparedFile> {
    const folder = this.lookup.folderOf(project);
    const comparison = comparisonOf(url);
    const path = url.searchParams.get("path") ?? "";
    const isCompared = await this.compare.isChanged(folder, comparison, path).catch(() => false);
    if (!isCompared) throw new HttpError(HTTP_STATUS.notFound, `No changes in ${path}`);
    return [folder, comparison, path];
  }
}

/** The project's folder, the two branches, and a file that differs between them. */
type ComparedFile = [folder: string, comparison: ComparisonView, path: string];

function comparisonOf(url: URL): ComparisonView {
  return comparisonQuery.parse(Object.fromEntries(url.searchParams));
}
