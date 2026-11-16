import { join } from "node:path";
import type { ProjectRepositories } from "../../review/project-repositories.js";
import type { RepositoryView } from "../change-views.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import type { UiLookup } from "./ui-lookup.js";

/** The repositories of a known project, and the folder of one of them; a repository it doesn't hold is a 404. */
export class RepositoryLookup {
  constructor(
    private lookup: Pick<UiLookup, "folderOf">,
    private repositories: ProjectRepositories,
  ) {}

  async list(project: string): Promise<RepositoryView[]> {
    return await this.repositories.list(this.lookup.folderOf(project));
  }

  /** An empty `repository` is the project's own folder. */
  folderOf(project: string, repository: string): string {
    const projectFolder = this.lookup.folderOf(project);
    if (!repository) return projectFolder;
    if (!this.repositories.has(projectFolder, repository)) {
      throw new HttpError(HTTP_STATUS.notFound, `No repository ${repository} in ${project}`);
    }
    return join(projectFolder, repository);
  }
}
