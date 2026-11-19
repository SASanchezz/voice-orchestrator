// The git repositories a project's Review can compare branches in: the project's own, or, for a folder that holds
// several repositories, each one directly inside it.

import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { RepositoryView } from "../ui/change-views.js";
import { repositoryRootOf, runGit, type GitRunner } from "./git-runner.js";

const CURRENT_BRANCH = ["branch", "--show-current"];
const DEPENDENCIES_FOLDER = "node_modules";

export class ProjectRepositories {
  constructor(private git: GitRunner = runGit) {}

  /** Sorted by folder; empty when the project's folder neither is nor holds a repository. */
  async list(projectFolder: string): Promise<RepositoryView[]> {
    const isRepository = Boolean(await repositoryRootOf(this.git, projectFolder));
    const folders = isRepository ? [""] : this.nestedIn(projectFolder);
    return await Promise.all(folders.map((folder) => this.describe(projectFolder, folder)));
  }

  /** The folders of the repositories directly inside the project's folder, sorted. */
  nestedIn(projectFolder: string): string[] {
    if (!existsSync(projectFolder)) return [];
    const entries = readdirSync(projectFolder, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    return entries
      .map((entry) => entry.name)
      .filter((name) => this.has(projectFolder, name))
      .toSorted();
  }

  /** Whether `folder` names a repository directly inside the project's folder, so nothing else can be reached. */
  has(projectFolder: string, folder: string): boolean {
    return ProjectRepositories.isPlainChild(folder) && existsSync(join(projectFolder, folder, ".git"));
  }

  private async describe(projectFolder: string, folder: string): Promise<RepositoryView> {
    const current = await this.git(join(projectFolder, folder), CURRENT_BRANCH).catch(() => "");
    return { folder, current: current.trim() };
  }

  /** One folder name, neither hidden nor installed dependencies. */
  private static isPlainChild(folder: string): boolean {
    const isOneName = folder === basename(folder);
    return isOneName && !folder.startsWith(".") && folder !== DEPENDENCIES_FOLDER;
  }
}
