// A project's uncommitted changes, whether its folder is a git repository or holds several side by side. For a folder
// of repositories, every file's path starts with its repository's folder, so one list covers them all and each path
// still names exactly one file.

import { join } from "node:path";
import type { ChangedFileView, FileDiffView, ProjectChangesView } from "../ui/change-views.js";
import type { GitChanges, LinesRequest } from "./git-changes.js";
import { repositoryRootOf, runGit, type GitRunner } from "./git-runner.js";
import type { ProjectRepositories } from "./project-repositories.js";

const SEPARATOR = "/";

/** A repository's folder and a file's path inside it. */
type FilePlace = [repository: string, path: string];

export class FolderChanges {
  constructor(
    private changes: GitChanges,
    private repositories: ProjectRepositories,
    private git: GitRunner = runGit,
  ) {}

  async ofProject(project: string, folder: string): Promise<ProjectChangesView> {
    const nested = await this.nestedRepositories(folder);
    if (!nested.length) return await this.changes.ofProject(project, folder);
    const views = await Promise.all(nested.map((name) => this.changes.ofProject(project, join(folder, name))));
    const files = views.flatMap((view, index) => FolderChanges.prefixed(nested[index], view.files));
    const moreFiles = views.reduce((sum, view) => sum + view.moreFiles, 0);
    return { project, isRepository: true, files, moreFiles, repositories: nested };
  }

  async isChanged(folder: string, path: string): Promise<boolean> {
    if (!(await this.canPlace(folder, path))) return false;
    return await this.changes.isChanged(...(await this.placeOf(folder, path)));
  }

  async diffOf(folder: string, path: string): Promise<FileDiffView> {
    const diff = await this.changes.diffOf(...(await this.placeOf(folder, path)));
    return { ...diff, path };
  }

  async stage(folder: string, path: string): Promise<void> {
    await this.changes.stage(...(await this.placeOf(folder, path)));
  }

  async hiddenLines(folder: string, path: string, request: LinesRequest): Promise<string[]> {
    const [repository, inner] = await this.placeOf(folder, path);
    return await this.changes.hiddenLines(repository, inner, request);
  }

  /** Empty when the folder is in a repository itself, which then speaks for everything under it. */
  private async nestedRepositories(folder: string): Promise<string[]> {
    if (await repositoryRootOf(this.git, folder)) return [];
    return this.repositories.nestedIn(folder);
  }

  private async canPlace(folder: string, path: string): Promise<boolean> {
    return Boolean(await repositoryRootOf(this.git, folder)) || this.isInNestedRepository(folder, path);
  }

  /** Throws when the path names no file in a repository of the folder. */
  private async placeOf(folder: string, path: string): Promise<FilePlace> {
    if (await repositoryRootOf(this.git, folder)) return [folder, path];
    if (!this.isInNestedRepository(folder, path)) throw new Error(`No repository holds ${path}.`);
    const [repository, ...rest] = path.split(SEPARATOR);
    return [join(folder, repository), rest.join(SEPARATOR)];
  }

  private isInNestedRepository(folder: string, path: string): boolean {
    const [repository, ...rest] = path.split(SEPARATOR);
    return rest.length > 0 && this.repositories.has(folder, repository);
  }

  private static prefixed(repository: string, files: ChangedFileView[]): ChangedFileView[] {
    return files.map((file) => ({ ...file, path: repository + SEPARATOR + file.path }));
  }
}
