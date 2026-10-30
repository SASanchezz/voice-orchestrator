import { z } from "zod";
import type { GitChanges } from "../../review/git-changes.js";
import { requireChanged } from "./changes-routes.js";
import type { UiLookup } from "./ui-lookup.js";

const stageBody = z.object({ path: z.string().min(1) });

/** The Review view's one change to a repository: staging a file. Nothing is committed or discarded from it. */
export class ChangeActions {
  constructor(
    private lookup: UiLookup,
    private changes: GitChanges,
  ) {}

  async stage(project: string, body: unknown): Promise<string> {
    const { path } = stageBody.parse(body);
    const folder = this.lookup.folderOf(project);
    await requireChanged(this.changes, folder, path);
    await this.changes.stage(folder, path);
    return `Staged ${path}.`;
  }
}
